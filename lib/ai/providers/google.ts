import { GoogleGenAI } from "@google/genai";
import { ProviderAdapter, AIModel, ChatMessage } from "./base";

export class GoogleProvider implements ProviderAdapter {
  id = "google";
  name = "Google Gemini";

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.get({ model: "gemini-3.5-flash" });
      return true;
    } catch (error) {
      console.error("GoogleProvider testConnection error:", error);
      throw new Error("Invalid API Key or connection failed.");
    }
  }

  async discoverModels(apiKey: string): Promise<AIModel[]> {
    return [
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "google", capabilities: ["text", "vision"] },
      { id: "gemini-3.5-pro", name: "Gemini 3.5 Pro", provider: "google", capabilities: ["text", "vision", "reasoning"] },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", capabilities: ["text", "vision"] },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", capabilities: ["text", "vision", "reasoning"] }
    ];
  }

  async chat(apiKey: string, modelId: string, messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    
    const contents = messages.map(m => {
      const parts: any[] = [];
      if (m.content) {
        parts.push({ text: m.content });
      }
      if (m.attachments && m.attachments.length > 0) {
        for (const att of m.attachments) {
          parts.push({
            inlineData: {
              data: att.data,
              mimeType: att.type
            }
          });
        }
      }
      if (parts.length === 0) {
        parts.push({ text: " " });
      }
      return {
        role: m.role === 'user' ? 'user' : 'model',
        parts
      };
    });

    const config: any = {};
    if (systemPrompt) {
      config.systemInstruction = systemPrompt;
    }

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents,
        config
      });
      return response.text;
    } catch (error: any) {
      console.error("GoogleProvider chat error:", error);
      throw new Error(error.message || "Failed to generate content.");
    }
  }
}
