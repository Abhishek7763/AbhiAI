'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { detectSpeechLanguage, toSpeakableText } from '@/lib/voice';

type VoiceHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useLiveVoice() {
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceStatus>('idle');

  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const voiceHistoryRef = useRef<VoiceHistoryMessage[]>([]);

  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.abort();
    } catch {
      // Recognition may already be inactive.
    }
  }, []);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    busyRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopRecognition();

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    recognitionRef.current = null;
    voiceHistoryRef.current = [];
    setStatus('idle');
    setIsLive(false);
  }, [stopRecognition]);

  const startRecognition = useCallback(() => {
    if (!activeRef.current || busyRef.current || !recognitionRef.current) return;
    setError(null);
    setStatus('listening');
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      if (err?.name !== 'InvalidStateError') {
        activeRef.current = false;
        setError('Could not restart microphone listening.');
        setStatus('error');
      }
    }
  }, []);

  const speakReply = useCallback((text: string) => {
    if (!activeRef.current || typeof window === 'undefined' || !window.speechSynthesis) {
      busyRef.current = false;
      startRecognition();
      return;
    }

    const cleanText = toSpeakableText(text);
    if (!cleanText) {
      busyRef.current = false;
      startRecognition();
      return;
    }

    setStatus('speaking');
    const language = detectSpeechLanguage(cleanText, navigator.language || 'en-US');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language;
    utterance.rate = 1;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const languagePrefix = language.split('-')[0].toLowerCase();
    const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
    const preferredVoice = matchingVoices.find((voice) => /natural|google|neural|enhanced/i.test(voice.name)) || matchingVoices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    const continueConversation = () => {
      busyRef.current = false;
      if (activeRef.current) startRecognition();
    };

    utterance.onend = continueConversation;
    utterance.onerror = continueConversation;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [startRecognition]);

  const processVoiceTurn = useCallback(async (transcript: string) => {
    if (!activeRef.current || !transcript.trim()) return;

    busyRef.current = true;
    setError(null);
    setStatus('thinking');

    const userText = transcript.trim();
    const priorHistory = voiceHistoryRef.current.slice(-8);
    voiceHistoryRef.current = [...priorHistory, { role: 'user', content: userText }];

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: userText,
          history: priorHistory,
          modelId: 'default',
          attachments: [],
          webSearch: false,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Voice response could not be generated.');
      }

      if (!response.body) {
        throw new Error('Voice response stream is unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (activeRef.current) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.replace(/^data:\s*/, '');
          if (!payload) continue;

          try {
            const event = JSON.parse(payload);
            if (event.type === 'delta' && event.text) {
              assistantText += event.text;
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Voice response failed.');
            }
          } catch (parseError: any) {
            if (!(parseError instanceof SyntaxError)) {
              throw parseError;
            }
          }
        }
      }

      if (!activeRef.current) return;
      if (!assistantText.trim()) {
        throw new Error('AbhiAI returned an empty voice response.');
      }

      voiceHistoryRef.current = [
        ...voiceHistoryRef.current.slice(-8),
        { role: 'assistant', content: assistantText },
      ];
      speakReply(assistantText);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Live voice error:', err);
      activeRef.current = false;
      setError(err?.message || 'Voice conversation is temporarily unavailable.');
      setStatus('error');
      busyRef.current = false;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [speakReply]);

  const startLiveMode = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setIsLive(true);
    setError(null);
    setStatus('idle');
    voiceHistoryRef.current = [];

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition || !window.speechSynthesis) {
      setError('Live voice needs browser speech recognition and text-to-speech support. Try the latest Chrome or Edge.');
      setStatus('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as any[])
        .map((result: any) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        void processVoiceTurn(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return;
      if (event.error === 'no-speech') {
        busyRef.current = false;
        if (activeRef.current) startRecognition();
        return;
      }

      activeRef.current = false;
      const permissionError = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      setError(permissionError
        ? 'Microphone permission is blocked. Allow microphone access and start Voice Mode again.'
        : 'Microphone listening stopped unexpectedly.');
      setStatus('error');
      busyRef.current = false;
    };

    recognition.onend = () => {
      if (activeRef.current && !busyRef.current) {
        window.setTimeout(startRecognition, 250);
      }
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    busyRef.current = false;
    startRecognition();
  }, [processVoiceTurn, startRecognition]);

  const stopLiveMode = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return {
    isLive,
    error,
    status,
    startLiveMode,
    stopLiveMode,
  };
}
