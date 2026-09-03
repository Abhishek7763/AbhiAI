import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getAppSettings } from "@/lib/app-settings";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      style = "photorealistic",
      aspectRatio = "1:1",
      engine = "auto",
      negativePrompt,
    } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required to generate an image." },
        { status: 400 }
      );
    }

    const appSettings = getAppSettings();
    const effectiveGeminiKey = appSettings.geminiApiKey || process.env.GEMINI_API_KEY;
    const effectiveOpenAIKey = appSettings.openaiApiKey || process.env.OPENAI_API_KEY;
    const customEndpoint = appSettings.customImageApiEndpoint || process.env.CUSTOM_IMAGE_API_ENDPOINT;

    const cleanPrompt = prompt.trim();
    let enhancedPrompt = cleanPrompt;
    switch (style) {
      case "photorealistic":
        enhancedPrompt = `${cleanPrompt}, 8k resolution, highly detailed photorealistic, professional photography, natural lighting, sharp focus, 35mm lens shot, award winning photography`;
        break;
      case "3d_render":
        enhancedPrompt = `${cleanPrompt}, 3D digital art, octane render, Unreal Engine 5 render, raytracing, vibrant lighting, smooth volumetric shading, 4k ultra detailed`;
        break;
      case "anime":
        enhancedPrompt = `${cleanPrompt}, Japanese anime aesthetic, Makoto Shinkai style, vibrant colors, clean lineart, beautiful lighting, masterpiece, high quality`;
        break;
      case "cyberpunk":
        enhancedPrompt = `${cleanPrompt}, cyberpunk futuristic aesthetic, neon glows, holographic reflections, moody atmospheric dark sci-fi city, 8k`;
        break;
      case "cinematic":
        enhancedPrompt = `${cleanPrompt}, cinematic film still, dramatic composition, Panavision 70mm, warm golden hour atmospheric lighting, movie scene, shallow depth of field`;
        break;
      case "digital_art":
        enhancedPrompt = `${cleanPrompt}, digital painting, concept art, trending on ArtStation, dynamic brushwork, intricate details, vivid palette`;
        break;
      case "minimalist":
        enhancedPrompt = `${cleanPrompt}, minimalist graphic design, clean vector silhouette, elegant flat modern art, balanced negative space`;
        break;
      case "fantasy":
        enhancedPrompt = `${cleanPrompt}, high fantasy concept art, mystical atmosphere, magical particles, ethereal glow, legendary aesthetic, ultra detailed`;
        break;
      case "oil_painting":
        enhancedPrompt = `${cleanPrompt}, classical oil painting on textured canvas, rich impasto brushstrokes, Renaissance lighting, dramatic chiaroscuro`;
        break;
      default:
        enhancedPrompt = cleanPrompt;
    }

    if (customEndpoint) {
      try {
        const customRes = await fetch(customEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: enhancedPrompt, style, aspectRatio, negativePrompt }),
        });
        if (customRes.ok) {
          const cData = await customRes.json();
          if (cData.imageUrl || cData.url) {
            return NextResponse.json({
              success: true,
              imageUrl: cData.imageUrl || cData.url,
              prompt: cleanPrompt,
              enhancedPrompt,
              provider: "Custom Image Server",
              style,
              aspectRatio,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        logger.warn('Custom image endpoint failed; continuing to configured fallbacks.', error);
      }
    }

    if ((engine === "imagen" || engine === "auto") && effectiveGeminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: effectiveGeminiKey });
        let geminiAspect: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1";
        if (aspectRatio === "16:9" || aspectRatio === "9:16" || aspectRatio === "4:3" || aspectRatio === "3:4") {
          geminiAspect = aspectRatio;
        }

        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image",
          contents: {
            parts: [{ text: enhancedPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: geminiAspect,
              imageSize: "1K",
            },
          },
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || "image/png";
              const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
              return NextResponse.json({
                success: true,
                imageUrl,
                prompt: cleanPrompt,
                enhancedPrompt,
                provider: "Google Gemini Imagen 3",
                style,
                aspectRatio,
                timestamp: Date.now(),
              });
            }
          }
        }
      } catch (error) {
        logger.warn('Gemini image generation failed; continuing to configured fallbacks.', error);
      }
    }

    if ((engine === "dalle" || (engine === "auto" && !effectiveGeminiKey)) && effectiveOpenAIKey) {
      try {
        let dalleSize = "1024x1024";
        if (aspectRatio === "16:9") dalleSize = "1792x1024";
        if (aspectRatio === "9:16") dalleSize = "1024x1792";

        const openAiRes = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${effectiveOpenAIKey}`,
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: enhancedPrompt,
            n: 1,
            size: dalleSize,
            response_format: "url",
          }),
        });

        if (openAiRes.ok) {
          const openAiData = await openAiRes.json();
          const imageUrl = openAiData.data?.[0]?.url;
          if (imageUrl) {
            return NextResponse.json({
              success: true,
              imageUrl,
              prompt: cleanPrompt,
              enhancedPrompt,
              provider: "OpenAI DALL-E 3",
              style,
              aspectRatio,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        logger.warn('DALL-E image generation failed; continuing to fallback.', error);
      }
    }

    let width = 1024;
    let height = 1024;
    if (aspectRatio === "16:9") {
      width = 1280;
      height = 720;
    } else if (aspectRatio === "9:16") {
      width = 720;
      height = 1280;
    } else if (aspectRatio === "4:3") {
      width = 1024;
      height = 768;
    } else if (aspectRatio === "3:4") {
      width = 768;
      height = 1024;
    }

    const seed = Math.floor(Math.random() * 10000000);
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const fluxImageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=false&model=flux`;

    return NextResponse.json({
      success: true,
      imageUrl: fluxImageUrl,
      prompt: cleanPrompt,
      enhancedPrompt,
      provider: "Flux.1 Ultra HD",
      style,
      aspectRatio,
      timestamp: Date.now(),
      seed,
    });
  } catch (error) {
    logger.error('Image generation API error.', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate image. Please try again." },
      { status: 500 }
    );
  }
}
