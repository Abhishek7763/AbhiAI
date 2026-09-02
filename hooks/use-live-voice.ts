'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export function useLiveVoice() {
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Audio queue for playback
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(console.error);
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(console.error);
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsLive(false);
  }, []);

  const playNextAudio = async () => {
    if (!outputAudioCtxRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift();
    if (!chunk) {
      isPlayingRef.current = false;
      return;
    }
    
    try {
      const audioBuffer = outputAudioCtxRef.current.createBuffer(1, chunk.length, 24000);
      audioBuffer.getChannelData(0).set(chunk);
      const source = outputAudioCtxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioCtxRef.current.destination);
      source.onended = () => {
        playNextAudio();
      };
      source.start();
    } catch (err) {
      console.error("Error playing audio chunk:", err);
      playNextAudio();
    }
  };

  const startLiveMode = async () => {
    try {
      setError(null);
      // Determine ws protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsLive(true);
        // Request Mic
        const stream = await navigator.mediaDevices.getUserMedia({ audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
        } });
        mediaStreamRef.current = stream;

        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        inputAudioCtxRef.current = inputCtx;
        
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        outputAudioCtxRef.current = outputCtx;

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert Float32 to Int16 Base64
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              let s = Math.max(-1, Math.min(1, inputData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            const buffer = new Uint8Array(pcm16.buffer);
            let binary = '';
            for (let i = 0; i < buffer.byteLength; i++) {
              binary += String.fromCharCode(buffer[i]);
            }
            const base64 = btoa(binary);
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.interrupted) {
          audioQueueRef.current = []; // Clear queue
        }
        if (msg.audio) {
          // Decode Base64 to Float32Array for AudioContext
          const binary = atob(msg.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const int16Array = new Int16Array(bytes.buffer);
          const float32Array = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
          }
          
          audioQueueRef.current.push(float32Array);
          if (!isPlayingRef.current) {
            playNextAudio();
          }
        }
      };

      ws.onclose = () => {
        cleanup();
      };

      ws.onerror = (err) => {
        console.error("Live Voice WS Error:", err);
        setError("Connection error. Please try again.");
        cleanup();
      };
    } catch (err: any) {
      console.error("Failed to start Live Mode:", err);
      setError(err.message || "Could not access microphone.");
      cleanup();
    }
  };

  const stopLiveMode = () => {
    cleanup();
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isLive,
    error,
    startLiveMode,
    stopLiveMode
  };
}
