import express from 'express';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { getAppSettings } from './lib/app-settings';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = 3000;

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);

  // Setup WebSocket Server
  const wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on('connection', async (clientWs) => {
    try {
      const appSettings = getAppSettings();
      const geminiKey = appSettings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error('GEMINI_API_KEY not configured in settings or environment.');
      }
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are a helpful, conversational voice assistant. Keep answers concise.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            console.log("Live API disconnected");
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
          }
        },
      });

      clientWs.on('message', (data) => {
        try {
          const { audio } = JSON.parse(data.toString());
          if (audio) {
            session.sendRealtimeInput({
              audio: { data: audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
        } catch (err) {
          console.error("Error processing client audio:", err);
        }
      });

      clientWs.on('close', () => {
        console.log("Client disconnected");
        // Need to close session if possible, though SDK handles it or drops it when input stops
      });
    } catch (error) {
      console.error("Error starting live session:", error);
      clientWs.close();
    }
  });

  server.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
