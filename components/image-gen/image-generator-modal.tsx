'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Maximize2,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Skeleton } from '@/components/ui/skeleton';

export interface GeneratedImageItem {
  id: string;
  imageUrl: string;
  prompt: string;
  enhancedPrompt?: string;
  style: string;
  aspectRatio: string;
  provider: string;
  timestamp: number;
  cloud?: boolean;
}

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat?: (image: GeneratedImageItem) => void;
  initialPrompt?: string;
}

const STYLE_OPTIONS = [
  { id: 'photorealistic', label: 'Photorealistic', icon: '📸' },
  { id: '3d_render', label: '3D Render', icon: '🧊' },
  { id: 'anime', label: 'Anime / Manga', icon: '✨' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: '🌆' },
  { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
  { id: 'digital_art', label: 'Digital Art', icon: '🎨' },
  { id: 'fantasy', label: 'High Fantasy', icon: '🐉' },
  { id: 'minimalist', label: 'Minimalist', icon: '⚪' },
  { id: 'oil_painting', label: 'Oil Painting', icon: '🖌️' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square', shape: 'w-4 h-4' },
  { id: '16:9', label: 'Landscape', shape: 'w-6 h-3.5' },
  { id: '9:16', label: 'Portrait', shape: 'w-3.5 h-6' },
  { id: '4:3', label: 'Classic', shape: 'w-5 h-4' },
  { id: '3:4', label: 'Tall', shape: 'w-4 h-5' },
];

const ENGINES = [
  { id: 'auto', label: 'Auto (Best available)' },
  { id: 'imagen', label: 'Google Gemini Image' },
  { id: 'openai', label: 'OpenAI GPT Image' },
  { id: 'stability', label: 'Stability AI' },
  { id: 'flux', label: 'Pollinations Flux' },
];

const INSPIRATION_PROMPTS = [
  'A majestic cybernetic lion in neon Tokyo street, rain reflections, 8k cinematic',
  'Cozy warm wooden cabin covered in fresh snow during golden sunset, ultra photorealistic',
  'Futuristic astronaut floating near Saturn rings holding a glowing ancient crystal orb',
  'A cute baby red panda wearing tiny pilot goggles and vintage aviator jacket, 3d render',
  'Floating islands in the clouds with glowing waterfalls and fantasy castles, digital art',
  'Minimalist geometric logo of an origami phoenix rising from blue flames',
];

const LOCAL_GALLERY_KEY = 'abhi_ai_generated_images';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function mergeGallery(localItems: GeneratedImageItem[], cloudItems: GeneratedImageItem[]) {
  const seen = new Set<string>();
  return [...cloudItems, ...localItems]
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((item) => {
      const key = `${item.prompt}|${item.timestamp}|${item.provider}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      reject(new Error('Use a PNG, JPEG, or WebP image.'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('Image is too large. Maximum size is 10 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
}

async function remoteImageToDataUrl(url: string) {
  if (url.startsWith('data:image/')) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load this image for editing.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Selected history item is not a supported image.');
  return await readImageFile(new File([blob], 'source-image', { type: blob.type }));
}

export function ImageGeneratorModal({ isOpen, onClose, onInsertToChat, initialPrompt = '' }: ImageGeneratorModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState('photorealistic');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [engine, setEngine] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<GeneratedImageItem | null>(null);
  const [gallery, setGallery] = useState<GeneratedImageItem[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'gallery'>('create');
  const [copied, setCopied] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState<string | null>(null);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [maskName, setMaskName] = useState<string | null>(null);

  const isEditing = Boolean(referenceImage);
  const actionLabel = isEditing ? 'Edit Image' : 'Generate Image';

  const localGallery = useMemo(() => gallery.filter((item) => !item.cloud), [gallery]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialPrompt) {
      setPrompt(initialPrompt);
      setActiveTab('create');
    }

    let localItems: GeneratedImageItem[] = [];
    try {
      const saved = localStorage.getItem(LOCAL_GALLERY_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) localItems = parsed;
    } catch (storageError) {
      logger.warn('Could not load local image gallery.', storageError);
      setStorageWarning('Local image history could not be loaded. Cloud history and new generations can still work.');
    }
    setGallery(localItems);

    let cancelled = false;
    setHistoryLoading(true);
    void fetch('/api/generated-images')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load cloud image history.');
        if (!cancelled && Array.isArray(data.images)) {
          setGallery((existing) => mergeGallery(existing, data.images));
        }
      })
      .catch((historyError) => {
        logger.warn('Cloud image history request failed.', historyError);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, initialPrompt]);

  const persistLocalGallery = (items: GeneratedImageItem[]) => {
    const localOnly = items.filter((item) => !item.cloud).slice(0, 20);
    try {
      localStorage.setItem(LOCAL_GALLERY_KEY, JSON.stringify(localOnly));
      setStorageWarning(null);
    } catch (storageError) {
      logger.warn('Could not save generated image history locally.', storageError);
      setStorageWarning('This image is available now, but your browser could not save it locally.');
    }
  };

  const saveToGallery = (item: GeneratedImageItem) => {
    setGallery((existing) => {
      const updated = mergeGallery([item, ...existing], []);
      persistLocalGallery(updated);
      return updated;
    });
  };

  const clearGallery = async () => {
    try {
      localStorage.removeItem(LOCAL_GALLERY_KEY);
      const response = await fetch('/api/generated-images', { method: 'DELETE' });
      if (!response.ok && response.status !== 401) {
        const data = await response.json();
        throw new Error(data.error || 'Cloud history could not be cleared.');
      }
      setGallery([]);
      setStorageWarning(null);
      toast.success(response.status === 401 ? 'Local image history cleared' : 'Image history cleared');
    } catch (clearError) {
      logger.warn('Could not completely clear image history.', clearError);
      setGallery(localGallery.filter(() => false));
      toast.error(clearError instanceof Error ? clearError.message : 'Could not clear image history.');
    }
  };

  const handleSourceFile = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      setReferenceImage(dataUrl);
      setReferenceName(file.name);
      setError(null);
      toast.success('Reference image ready for editing');
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Could not load image.');
    }
  };

  const handleMaskFile = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      setMaskImage(dataUrl);
      setMaskName(file.name);
      toast.success('Optional edit mask added');
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Could not load mask.');
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint = isEditing ? '/api/edit-image' : '/api/generate-image';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          aspectRatio,
          engine,
          ...(referenceImage ? { sourceImage: referenceImage } : {}),
          ...(maskImage ? { maskImage } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || `${actionLabel} failed.`);

      const newItem: GeneratedImageItem = {
        id: data.generatedImageId || `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        imageUrl: data.imageUrl,
        prompt: data.prompt || prompt,
        enhancedPrompt: data.enhancedPrompt,
        style: data.style || style,
        aspectRatio: data.aspectRatio || aspectRatio,
        provider: data.provider || 'AbhiAI Image Studio',
        timestamp: data.timestamp || Date.now(),
        cloud: Boolean(data.generatedImageId),
      };
      setCurrentImage(newItem);
      saveToGallery(newItem);
      toast.success(isEditing ? 'Image edited successfully' : 'Image generated successfully', {
        description: `${newItem.provider} • ${newItem.aspectRatio}`,
      });
    } catch (generationError) {
      logger.warn(`${actionLabel} request failed.`, generationError);
      const message = generationError instanceof Error ? generationError.message : `${actionLabel} failed. Please try again.`;
      setError(message);
      toast.error(`${actionLabel} failed`, { description: message });
    } finally {
      setLoading(false);
    }
  };

  const startVariation = (item: GeneratedImageItem) => {
    setReferenceImage(null);
    setReferenceName(null);
    setMaskImage(null);
    setMaskName(null);
    setPrompt(`Create a distinct variation of this concept while preserving the main subject: ${item.prompt}`);
    setStyle(item.style);
    setAspectRatio(item.aspectRatio);
    setCurrentImage(item);
    setActiveTab('create');
    toast.message('Variation ready', { description: 'Adjust the prompt if you want, then generate.' });
  };

  const startEditFromHistory = async (item: GeneratedImageItem) => {
    try {
      const dataUrl = await remoteImageToDataUrl(item.imageUrl);
      setReferenceImage(dataUrl);
      setReferenceName('History image');
      setPrompt(`Edit this image: ${item.prompt}`);
      setStyle(item.style);
      setAspectRatio(item.aspectRatio);
      setCurrentImage(item);
      setActiveTab('create');
      toast.success('Image loaded into edit mode');
    } catch (editError) {
      toast.error(editError instanceof Error ? editError.message : 'Could not load this image for editing.');
    }
  };

  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Prompt copied');
      setTimeout(() => setCopied(false), 1800);
    } catch (clipboardError) {
      logger.warn('Could not copy image prompt.', clipboardError);
      toast.error('Could not copy the prompt.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-label="AbhiAI Image Studio" className="abhiai-dialog-surface relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100">
        <header className="px-4 sm:px-5 py-4 border-b border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate">AbhiAI Image Studio</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">Generate, edit, remix and revisit your AI images</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-200/60 dark:bg-zinc-800/60 p-0.5 rounded-xl text-xs font-medium">
              {(['create', 'gallery'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 rounded-lg capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-zinc-900 shadow-xs' : 'text-zinc-500'}`}>
                  {tab}{tab === 'gallery' && gallery.length > 0 ? ` (${gallery.length})` : ''}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close Image Studio"><X className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {storageWarning && <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{storageWarning}</div>}

          {activeTab === 'create' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form onSubmit={handleGenerate} className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5 text-blue-500" />{isEditing ? 'Describe the edit' : 'Describe what you want'}</label>
                  <button type="button" onClick={() => setPrompt(INSPIRATION_PROMPTS[Math.floor(Math.random() * INSPIRATION_PROMPTS.length)])} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"><Sparkles className="w-3 h-3" />Inspiration</button>
                </div>

                <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={isEditing ? 'e.g. Replace the background with a snowy mountain at sunset...' : 'e.g. Cyberpunk flying car in a neon city at night...'} className="w-full bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300 dark:border-zinc-700/80 rounded-2xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" />

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/60 dark:bg-zinc-950/30 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold">Reference image <span className="font-normal text-zinc-500">(optional)</span></p>
                      <p className="text-[11px] text-zinc-500">Upload one to switch from generation to image editing.</p>
                    </div>
                    {referenceImage && <button type="button" onClick={() => { setReferenceImage(null); setReferenceName(null); setMaskImage(null); setMaskName(null); }} className="text-xs text-red-500 hover:underline">Exit edit mode</button>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="cursor-pointer rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-2.5 text-xs flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60">
                      <Upload className="w-4 h-4" /><span className="truncate">{referenceName || 'Upload source image'}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void handleSourceFile(e.target.files?.[0])} />
                    </label>
                    <label className={`cursor-pointer rounded-xl border border-dashed p-2.5 text-xs flex items-center gap-2 ${referenceImage ? 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/60' : 'border-zinc-200 dark:border-zinc-800 opacity-50 pointer-events-none'}`}>
                      <Layers className="w-4 h-4" /><span className="truncate">{maskName || 'Optional inpaint mask'}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={!referenceImage} onChange={(e) => void handleMaskFile(e.target.files?.[0])} />
                    </label>
                  </div>
                  {referenceImage && <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400"><Check className="w-3.5 h-3.5" />Edit mode active. Gemini/OpenAI provider required.</div>}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-purple-500" />Artistic style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLE_OPTIONS.map((option) => <button key={option.id} type="button" onClick={() => setStyle(option.id)} className={`p-2.5 rounded-xl border text-left transition-all ${style === option.id ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 ring-1 ring-blue-500' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40'}`}><div className="flex items-center justify-between"><span>{option.icon}</span>{style === option.id && <Check className="w-3 h-3 text-blue-500" />}</div><span className="text-xs font-medium block truncate mt-1">{option.label}</span></button>)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 block">Aspect ratio</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ASPECT_RATIOS.map((ratio) => <button key={ratio.id} type="button" onClick={() => setAspectRatio(ratio.id)} className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${aspectRatio === ratio.id ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 text-blue-600 dark:text-blue-300' : 'border-zinc-200 dark:border-zinc-800'}`}><span className={`border border-current rounded-xs inline-block ${ratio.shape}`} /><span>{ratio.label} {ratio.id}</span></button>)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 block">AI engine</label>
                    <select value={engine} onChange={(e) => setEngine(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-300 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500">
                      {ENGINES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    {isEditing && ['stability', 'flux'].includes(engine) && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">This engine does not support AbhiAI edit mode. Choose Auto, Google, or OpenAI.</p>}
                  </div>
                </div>

                {error && <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-300 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

                <button type="submit" disabled={loading || !prompt.trim()} className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                  {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />{isEditing ? 'Applying edit...' : 'Rendering artwork...'}</> : <><Sparkles className="w-4 h-4" />{actionLabel}</>}
                </button>
              </form>

              <section className="lg:col-span-5 flex flex-col">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Canvas preview</label>
                <div className="flex-1 min-h-[340px] bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center overflow-hidden group">
                  {loading ? <div className="w-full p-4 space-y-3"><Skeleton className="w-full aspect-square max-h-[310px] rounded-2xl" /><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-1/2" /></div> : currentImage ? <div className="relative w-full h-full flex flex-col"><div className="relative flex-1 bg-black/5 flex items-center justify-center overflow-hidden"><img src={currentImage.imageUrl} alt={currentImage.prompt} className="max-h-[390px] w-full object-contain cursor-pointer" onClick={() => setFullscreenImage(currentImage.imageUrl)} /><button onClick={() => setFullscreenImage(currentImage.imageUrl)} className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/60 text-white"><Maximize2 className="w-4 h-4" /></button></div><div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 space-y-2"><div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold truncate">{currentImage.prompt}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 shrink-0">{currentImage.provider}</span></div><div className="grid grid-cols-2 gap-1.5"><button type="button" onClick={() => startVariation(currentImage)} className="py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs flex items-center justify-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Variation</button><button type="button" onClick={() => void startEditFromHistory(currentImage)} className="py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs flex items-center justify-center gap-1"><Wand2 className="w-3.5 h-3.5" />Edit this</button></div><div className="flex items-center gap-1.5"><button type="button" onClick={() => handleDownload(currentImage.imageUrl, currentImage.prompt)} className="flex-1 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" />Download</button><button type="button" onClick={() => void handleCopyPrompt(currentImage.prompt)} className="p-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl">{copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>{onInsertToChat && <button type="button" onClick={() => { onInsertToChat(currentImage); onClose(); }} className="py-1.5 px-3 bg-blue-600 text-white rounded-xl text-xs flex items-center gap-1"><Send className="w-3.5 h-3.5" />Use in Chat</button>}</div></div></div> : <div className="flex flex-col items-center p-6 text-center text-zinc-400 space-y-2"><div className="w-12 h-12 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60 flex items-center justify-center"><ImageIcon className="w-6 h-6" /></div><p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">No artwork yet</p><p className="text-[11px] text-zinc-500 max-w-[220px]">Generate a new image or upload a reference image to edit.</p></div>}
                </div>
              </section>
            </div>
          ) : (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3"><h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Generation history ({gallery.length})</h4>{gallery.length > 0 && <button onClick={() => { if (confirm('Clear local and cloud image history?')) void clearGallery(); }} className="text-xs text-red-500 hover:underline">Clear history</button>}</div>
              {historyLoading && gallery.length === 0 ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="aspect-square rounded-2xl" />)}</div> : gallery.length === 0 ? <div className="py-16 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800"><ImageIcon className="w-8 h-8 mx-auto text-zinc-400" /><p className="mt-3 text-sm font-medium">Your gallery is empty</p><p className="mt-1 text-xs text-zinc-500">Generated images will appear here and signed-in history syncs from Supabase.</p></div> : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">{gallery.map((item) => <article key={item.id} className="group bg-zinc-100 dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xs"><div className="relative aspect-square overflow-hidden bg-black/10"><img src={item.imageUrl} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" /><button onClick={() => setFullscreenImage(item.imageUrl)} className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100"><Maximize2 className="w-3.5 h-3.5" /></button>{item.cloud && <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded-full bg-black/60 text-white">Cloud</span>}</div><div className="p-2 bg-white dark:bg-zinc-900"><p className="text-[11px] font-medium line-clamp-2 min-h-8">{item.prompt}</p><div className="mt-2 grid grid-cols-2 gap-1"><button onClick={() => startVariation(item)} className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center justify-center gap-0.5 border border-zinc-200 dark:border-zinc-800 rounded-lg py-1">Variation<ChevronRight className="w-3 h-3" /></button><button onClick={() => void startEditFromHistory(item)} className="text-[11px] text-purple-600 dark:text-purple-400 font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg py-1">Edit</button></div></div></article>)}</div>}
            </section>
          )}
        </div>
      </div>

      {fullscreenImage && <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)} role="dialog" aria-modal="true"><button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-white"><X className="w-6 h-6" /></button><img src={fullscreenImage} alt="Fullscreen generated image" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(event) => event.stopPropagation()} /></div>}
    </div>
  );
}

export default ImageGeneratorModal;
