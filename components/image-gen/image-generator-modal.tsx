'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  X, 
  Download, 
  Copy, 
  Check, 
  Maximize2, 
  RefreshCw, 
  Wand2, 
  Layers, 
  Send, 
  Clock, 
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { logger } from '@/lib/logger';

export interface GeneratedImageItem {
  id: string;
  imageUrl: string;
  prompt: string;
  enhancedPrompt?: string;
  style: string;
  aspectRatio: string;
  provider: string;
  timestamp: number;
}

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat?: (image: GeneratedImageItem) => void;
  initialPrompt?: string;
}

const STYLE_OPTIONS = [
  { id: 'photorealistic', label: 'Photorealistic', icon: '📸', desc: '8K ultra-detailed photo' },
  { id: '3d_render', label: '3D Render', icon: '🧊', desc: 'Unreal Engine / Octane 3D' },
  { id: 'anime', label: 'Anime / Manga', icon: '✨', desc: 'Makoto Shinkai aesthetic' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: '🌆', desc: 'Neon city sci-fi' },
  { id: 'cinematic', label: 'Cinematic', icon: '🎬', desc: 'Movie still lighting' },
  { id: 'digital_art', label: 'Digital Art', icon: '🎨', desc: 'ArtStation concept art' },
  { id: 'fantasy', label: 'High Fantasy', icon: '🐉', desc: 'Mystical & magical' },
  { id: 'minimalist', label: 'Minimalist', icon: '⚪', desc: 'Clean vector design' },
  { id: 'oil_painting', label: 'Oil Painting', icon: '🖌️', desc: 'Classic canvas texture' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square (1:1)', shape: 'w-4 h-4' },
  { id: '16:9', label: 'Landscape (16:9)', shape: 'w-6 h-3.5' },
  { id: '9:16', label: 'Portrait (9:16)', shape: 'w-3.5 h-6' },
  { id: '4:3', label: 'Classic (4:3)', shape: 'w-5 h-4' },
];

const ENGINES = [
  { id: 'auto', label: 'Auto (Best Quality)', badge: 'Recommended' },
  { id: 'imagen', label: 'Google Gemini Imagen 3', badge: 'Gemini API' },
  { id: 'flux', label: 'Flux.1 Ultra HD', badge: 'Fast & High Res' },
  { id: 'dalle', label: 'OpenAI DALL-E 3', badge: 'Optional Key' },
];

const INSPIRATION_PROMPTS = [
  "A majestic cybernetic lion in neon Tokyo street, rain reflections, 8k cinematic",
  "Cozy warm wooden cabin covered in fresh snow during golden sunset, ultra photorealistic",
  "Futuristic astronaut floating near Saturn rings holding a glowing ancient crystal orb",
  "A cute baby red panda wearing tiny pilot goggles and vintage aviator jacket, 3d render",
  "Floating islands in the clouds with glowing waterfalls and fantasy castles, digital art",
  "Minimalist geometric logo of an origami phoenix rising from blue flames",
  "Cyberpunk supercar speeding through a rain-slicked highway at night, neon motion blur",
  "Enchanted forest library with books flying like glowing butterflies, magical fantasy",
];

export function ImageGeneratorModal({
  isOpen,
  onClose,
  onInsertToChat,
  initialPrompt = '',
}: ImageGeneratorModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [prevInitialPrompt, setPrevInitialPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState('photorealistic');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [engine, setEngine] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<GeneratedImageItem | null>(null);
  const [gallery, setGallery] = useState<GeneratedImageItem[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'gallery'>('create');
  const [copied, setCopied] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('abhi_ai_generated_images');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) setGallery(parsed);
    } catch (storageError) {
      logger.warn('Could not load the image gallery from browser storage.', storageError);
      setStorageWarning('Your saved image gallery could not be loaded. New images will still work in this session.');
    }
  }, []);

  if (initialPrompt && initialPrompt !== prevInitialPrompt) {
    setPrevInitialPrompt(initialPrompt);
    setPrompt(initialPrompt);
    setActiveTab('create');
  }

  const saveToGallery = (item: GeneratedImageItem) => {
    const updated = [item, ...gallery.filter(g => g.id !== item.id)].slice(0, 30);
    setGallery(updated);
    try {
      localStorage.setItem('abhi_ai_generated_images', JSON.stringify(updated));
      setStorageWarning(null);
    } catch (storageError) {
      logger.warn('Could not save the generated image gallery to browser storage.', storageError);
      setStorageWarning('This image is available now, but your browser could not save it to the local gallery.');
    }
  };

  const clearGallery = () => {
    setGallery([]);
    try {
      localStorage.removeItem('abhi_ai_generated_images');
      setStorageWarning(null);
    } catch (storageError) {
      logger.warn('Could not clear the image gallery from browser storage.', storageError);
      setStorageWarning('The gallery was cleared for this session, but browser storage could not be updated.');
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          aspectRatio,
          engine,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate image');
      }

      const newItem: GeneratedImageItem = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        imageUrl: data.imageUrl,
        prompt: data.prompt || prompt,
        enhancedPrompt: data.enhancedPrompt,
        style: data.style || style,
        aspectRatio: data.aspectRatio || aspectRatio,
        provider: data.provider || 'AI Image Studio',
        timestamp: data.timestamp || Date.now(),
      };

      setCurrentImage(newItem);
      saveToGallery(newItem);
    } catch (generationError) {
      logger.warn('Image generation request failed.', generationError);
      setError(generationError instanceof Error ? generationError.message : 'Error generating image. Please try another prompt or provider.');
    } finally {
      setLoading(false);
    }
  };

  const handleRandomPrompt = () => {
    const random = INSPIRATION_PROMPTS[Math.floor(Math.random() * INSPIRATION_PROMPTS.length)];
    setPrompt(random);
  };

  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (clipboardError) {
      logger.warn('Could not copy an image prompt to the clipboard.', clipboardError);
      setCopied(false);
      setError('Could not copy the prompt. Please select and copy it manually.');
    }
  };

  const handleDownload = (url: string, filenamePrompt: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `abhi-ai-${filenamePrompt.slice(0, 25).replace(/[^a-z0-9]/gi, '_')}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100">
        <div className="px-5 py-4 border-b border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">AbhiAI Image Studio</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                  AI Art Generator
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Transform any text prompt into high-definition digital artwork
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-200/60 dark:bg-zinc-800/60 p-0.5 rounded-xl text-xs font-medium">
              <button
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'create'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Create
              </button>
              <button
                onClick={() => setActiveTab('gallery')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'gallery'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <span>Gallery</span>
                {gallery.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-zinc-300 dark:bg-zinc-700 rounded-full text-[10px]">
                    {gallery.length}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {storageWarning && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>{storageWarning}</span>
            </div>
          )}

          {activeTab === 'create' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <form onSubmit={handleGenerate} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-blue-500" />
                      Describe What You Want to See
                    </label>
                    <button
                      type="button"
                      onClick={handleRandomPrompt}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      Inspiration
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={3}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Cyberpunk flying car in neon city at night, rain reflections, 8k cinematic..."
                      className="w-full bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300 dark:border-zinc-700/80 rounded-2xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 block flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-500" />
                      Artistic Style
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {STYLE_OPTIONS.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setStyle(st.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            style === st.id
                              ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 ring-1 ring-blue-500'
                              : 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-base">{st.icon}</span>
                            {style === st.id && <Check className="w-3 h-3 text-blue-500" />}
                          </div>
                          <span className="text-xs font-medium truncate">{st.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 block">
                        Aspect Ratio
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ASPECT_RATIOS.map((ar) => (
                          <button
                            key={ar.id}
                            type="button"
                            onClick={() => setAspectRatio(ar.id)}
                            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                              aspectRatio === ar.id
                                ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300'
                                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <span className={`border border-current rounded-xs inline-block ${ar.shape}`} />
                            <span className="truncate">{ar.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 block flex items-center justify-between">
                        <span>AI Engine</span>
                        <span className="text-[10px] text-zinc-400 normal-case">Multi-Provider</span>
                      </label>
                      <select
                        value={engine}
                        onChange={(e) => setEngine(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                      >
                        {ENGINES.map((eng) => (
                          <option key={eng.id} value={eng.id}>
                            {eng.label} ({eng.badge})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !prompt.trim()}
                    className="w-full mt-2 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Rendering Artwork...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Image</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="p-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 text-[11px] text-zinc-500 dark:text-zinc-400">
                  💡 <strong>Backend API ready:</strong> Connected with Google Gemini / Imagen 3 and Flux Ultra HD. You can also configure OpenAI or custom providers in <code>.env.example</code>.
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 block">
                  Canvas Preview
                </label>

                <div className="flex-1 min-h-[320px] bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                  {loading ? (
                    <div className="flex flex-col items-center p-6 text-center space-y-3">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                        <Sparkles className="w-6 h-6 text-blue-500 absolute inset-0 m-auto animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          Creating your masterpiece...
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          Applying {style} style & high-definition rendering
                        </p>
                      </div>
                    </div>
                  ) : currentImage ? (
                    <div className="relative w-full h-full flex flex-col">
                      <div className="relative flex-1 bg-black/5 flex items-center justify-center overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentImage.imageUrl}
                          alt={currentImage.prompt}
                          className="max-h-[360px] w-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
                          onClick={() => setFullscreenImage(currentImage.imageUrl)}
                        />
                        <button
                          onClick={() => setFullscreenImage(currentImage.imageUrl)}
                          className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/60 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                          title="Fullscreen preview"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                            {currentImage.prompt}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {currentImage.provider}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={() => handleDownload(currentImage.imageUrl, currentImage.prompt)}
                            className="flex-1 py-1.5 px-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>

                          <button
                            onClick={() => void handleCopyPrompt(currentImage.prompt)}
                            className="p-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Copy Prompt"
                          >
                            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>

                          {onInsertToChat && (
                            <button
                              onClick={() => {
                                onInsertToChat(currentImage);
                                onClose();
                              }}
                              className="py-1.5 px-3 bg-blue-600 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-blue-700 transition-colors"
                              title="Send image to active chat"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Use in Chat</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-6 text-center text-zinc-400 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-zinc-400" />
                      </div>
                      <p className="text-xs">No artwork generated yet.</p>
                      <p className="text-[11px] text-zinc-500 max-w-[200px]">
                        Type your prompt and click Generate to see live results here!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Your Generated Creations ({gallery.length})
                </h4>
                {gallery.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Clear image generation history?')) clearGallery();
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {gallery.length === 0 ? (
                <div className="py-16 text-center text-zinc-400 space-y-2">
                  <ImageIcon className="w-10 h-10 mx-auto text-zinc-400/60" />
                  <p className="text-sm font-medium">Your gallery is empty</p>
                  <p className="text-xs text-zinc-500">
                    Switch to Create tab to generate your first AI image!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {gallery.map((item) => (
                    <div
                      key={item.id}
                      className="group relative bg-zinc-100 dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col shadow-xs hover:shadow-md transition-all"
                    >
                      <div className="relative aspect-square overflow-hidden bg-black/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.prompt}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                          <button
                            onClick={() => setFullscreenImage(item.imageUrl)}
                            className="self-end p-1 rounded-lg bg-black/50 text-white hover:bg-black/80"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="space-y-1">
                            <p className="text-[11px] text-white font-medium line-clamp-2 leading-tight">
                              {item.prompt}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 bg-white dark:bg-zinc-900 flex items-center justify-between gap-1 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                          onClick={() => {
                            setCurrentImage(item);
                            setActiveTab('create');
                            setPrompt(item.prompt);
                            setStyle(item.style);
                          }}
                          className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-0.5"
                        >
                          <span>Remix</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDownload(item.imageUrl, item.prompt)}
                            className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {onInsertToChat && (
                            <button
                              onClick={() => {
                                onInsertToChat(item);
                                onClose();
                              }}
                              className="p-1 text-blue-600 hover:text-blue-700 rounded"
                              title="Send to chat"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenImage}
            alt="Fullscreen preview"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default ImageGeneratorModal;
