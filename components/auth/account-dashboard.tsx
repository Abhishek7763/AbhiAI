'use client';

import { useEffect, useState } from 'react';
import { Cloud, Image as ImageIcon, Loader2, Settings, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AccountIdentity {
  id: string;
  email: string | null;
  name: string;
  provider: string;
}

interface GeneratedImageRow {
  id: string;
  prompt: string;
  provider: string;
  url: string;
  storage_path: string | null;
  created_at: string;
  displayUrl?: string;
}

export function AccountDashboard({ identity }: { identity: AccountIdentity }) {
  const [supabase] = useState(() => createClient());
  const [activeTab, setActiveTab] = useState<'settings' | 'images'>('settings');
  const [images, setImages] = useState<GeneratedImageRow[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadImages = async () => {
      setImagesLoading(true);
      setImagesError(null);
      const { data, error } = await supabase
        .from('generated_images')
        .select('id,prompt,provider,url,storage_path,created_at')
        .eq('user_id', identity.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (!active) return;
      if (error) {
        setImagesError('Could not load your cloud image history.');
        setImagesLoading(false);
        return;
      }

      const rows = (data ?? []) as GeneratedImageRow[];
      const storageRows = rows.filter((row) => Boolean(row.storage_path));
      const signedByPath = new Map<string, string>();

      if (storageRows.length > 0) {
        const paths = storageRows.map((row) => row.storage_path as string);
        const { data: signedData, error: signedError } = await supabase.storage
          .from('generated-images')
          .createSignedUrls(paths, 60 * 60);

        if (!active) return;
        if (signedError) {
          setImagesError('Some saved images could not be opened right now.');
        } else {
          for (const signed of signedData ?? []) {
            if (signed.path && signed.signedUrl) signedByPath.set(signed.path, signed.signedUrl);
          }
        }
      }

      setImages(
        rows.map((row) => ({
          ...row,
          displayUrl: row.storage_path ? signedByPath.get(row.storage_path) : row.url,
        })),
      );
      setImagesLoading(false);
    };

    void loadImages();
    return () => {
      active = false;
    };
  }, [identity.id, supabase]);

  const deleteImage = async (image: GeneratedImageRow) => {
    if (deletingId) return;
    setDeletingId(image.id);
    setImagesError(null);
    try {
      if (image.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('generated-images')
          .remove([image.storage_path]);
        if (storageError) throw storageError;
      }

      const { error } = await supabase
        .from('generated_images')
        .delete()
        .eq('user_id', identity.id)
        .eq('id', image.id);
      if (error) throw error;
      setImages((previous) => previous.filter((item) => item.id !== image.id));
    } catch {
      setImagesError('Could not delete this image. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 shadow-xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">Your AbhiAI account</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage cloud sync and access images generated while signed in.</p>
      </div>

      <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 flex gap-1 bg-zinc-50/70 dark:bg-zinc-950/40">
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('images')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'images' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
        >
          <ImageIcon className="w-4 h-4" />
          My Images
          {images.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800">{images.length}</span>}
        </button>
      </div>

      <div className="p-5 sm:p-6 min-h-[360px]">
        {activeTab === 'settings' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/60 dark:bg-zinc-950/40">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Account</p>
              <p className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">{identity.name}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 break-all">{identity.email}</p>
              <p className="mt-3 text-xs text-zinc-500">Sign-in provider: <span className="font-medium capitalize text-zinc-700 dark:text-zinc-300">{identity.provider}</span></p>
            </div>

            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-4 bg-emerald-50/60 dark:bg-emerald-950/25">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <Cloud className="w-4 h-4" />
                Cross-device sync active
              </div>
              <p className="mt-2 text-sm text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                Chats created while you are signed in are saved to your private AbhiAI cloud account and can be loaded on another device with the same login.
              </p>
            </div>
          </div>
        ) : imagesLoading ? (
          <div className="h-64 flex items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading My Images…
          </div>
        ) : (
          <div className="space-y-4">
            {imagesError && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                {imagesError}
              </div>
            )}

            {images.length === 0 ? (
              <div className="py-16 text-center text-zinc-400">
                <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-60" />
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No cloud images yet</p>
                <p className="mt-1 text-xs">Generate an image while signed in and it will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {images.map((image) => (
                  <article key={image.id} className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shadow-xs">
                    <div className="aspect-square bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                      {image.displayUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image.displayUrl} alt={image.prompt} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400"><ImageIcon className="w-7 h-7" /></div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-2">
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2">{image.prompt}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-zinc-400 truncate">{image.provider}</span>
                        <button
                          type="button"
                          onClick={() => void deleteImage(image)}
                          disabled={deletingId === image.id}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                          title="Delete image"
                        >
                          {deletingId === image.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountDashboard;
