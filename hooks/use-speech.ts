'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { detectSpeechLanguage, toSpeakableText } from '@/lib/voice';

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function speechRecognitionErrorMessage(error: string) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission is blocked. Allow microphone access and try again.';
    case 'audio-capture':
      return 'No usable microphone was found.';
    case 'network':
      return 'Speech recognition is temporarily unavailable.';
    case 'no-speech':
      return 'No speech was detected. Try speaking again.';
    default:
      return 'Voice dictation stopped unexpectedly. Please try again.';
  }
}

export function useSpeechToText(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptCallbackRef = useRef(onTranscript);

  useEffect(() => {
    transcriptCallbackRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    setIsSupported(Boolean(SpeechRecognition));
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = navigator.language || 'en-US';

    recognition.onstart = () => {
      setError(null);
      setInterimTranscript('');
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i]?.[0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim.trim());

      if (finalTranscript.trim()) {
        transcriptCallbackRef.current(finalTranscript.trim());
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        setError(speechRecognitionErrorMessage(event.error));
      }
      setInterimTranscript('');
      setIsListening(false);
    };

    recognition.onend = () => {
      setInterimTranscript('');
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // Recognition may already be inactive.
      }
      recognitionRef.current = null;
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      if (err?.name !== 'InvalidStateError') {
        setError('Could not start voice dictation. Please try again.');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Recognition may already be inactive.
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}

export function useTextToSpeech() {
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const activeMessageRef = useRef<string | null>(null);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((messageId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (activeMessageRef.current === messageId) {
      window.speechSynthesis.cancel();
      activeMessageRef.current = null;
      setSpeakingMessageId(null);
      return;
    }

    const cleanText = toSpeakableText(text);
    if (!cleanText) return;

    window.speechSynthesis.cancel();

    const fallbackLanguage = navigator.language || 'en-US';
    const language = detectSpeechLanguage(cleanText, fallbackLanguage);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = language;

    const voices = window.speechSynthesis.getVoices();
    const languagePrefix = language.split('-')[0].toLowerCase();
    const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
    const preferredVoice = matchingVoices.find((voice) => /natural|google|samantha|neural|enhanced/i.test(voice.name)) || matchingVoices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      activeMessageRef.current = messageId;
      setSpeakingMessageId(messageId);
    };

    const clearSpeakingState = () => {
      if (activeMessageRef.current === messageId) {
        activeMessageRef.current = null;
        setSpeakingMessageId(null);
      }
    };

    utterance.onend = clearSpeakingState;
    utterance.onerror = clearSpeakingState;

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    activeMessageRef.current = null;
    setSpeakingMessageId(null);
  }, []);

  return { speakingMessageId, isSupported, speak, stop };
}
