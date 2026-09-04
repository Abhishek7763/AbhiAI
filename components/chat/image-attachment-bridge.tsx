'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ClipboardPaste } from 'lucide-react';

type PreviewItem = {
  key: string;
  name: string;
  url: string;
};

type Anchor = {
  left: number;
  top: number;
  width: number;
  right: number;
};

const MAX_ATTACHMENTS = 4;
const TARGET_IMAGE_BYTES = 620_000;
const MAX_IMAGE_DIMENSION = 1600;

function findChatFileInput() {
  return document.querySelector<HTMLInputElement>('form input[type="file"][accept*="image"]');
}

function getAttachmentRow(form: HTMLFormElement) {
  return Array.from(form.children).find((child) => {
    if (!(child instanceof HTMLElement)) return false;
    return child.classList.contains('flex') && child.classList.contains('flex-wrap') && child.classList.contains('border-b');
  }) as HTMLElement | undefined;
}

function getAttachmentNames(form: HTMLFormElement) {
  const row = getAttachmentRow(form);
  if (!row) return new Set<string>();
  return new Set(
    Array.from(row.querySelectorAll('span'))
      .map((span) => span.textContent?.trim() || '')
      .filter(Boolean),
  );
}

function currentAttachmentCount(form: HTMLFormElement) {
  return getAttachmentRow(form)?.children.length ?? 0;
}

function normalizePastedFile(file: File, index: number) {
  if (file.name && !/^image\.(png|jpe?g|webp)$/i.test(file.name)) return file;
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([file], `pasted-image-${Date.now()}-${index + 1}.${extension}`, {
    type: file.type || 'image/jpeg',
    lastModified: Date.now(),
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    image.src = url;
  });
}

async function optimizeImage(file: File) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (file.size <= TARGET_IMAGE_BYTES) return file;

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));
    let quality = 0.84;
    let bestBlob: Blob | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) return file;
      bestBlob = blob;
      if (blob.size <= TARGET_IMAGE_BYTES) break;

      quality = Math.max(0.58, quality - 0.08);
      width = Math.max(1, Math.round(width * 0.86));
      height = Math.max(1, Math.round(height * 0.86));
    }

    if (!bestBlob || bestBlob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([bestBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  }
}

export default function ImageAttachmentBridge() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [notice, setNotice] = useState('');
  const previewUrls = useRef(new Set<string>());
  const noticeTimer = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600);
  }, []);

  useEffect(() => {
    const urls = previewUrls.current;
    let input: HTMLInputElement | null = null;
    let form: HTMLFormElement | null = null;
    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let retryTimer: number | null = null;

    const updateAnchor = () => {
      if (!form) return;
      const rect = form.getBoundingClientRect();
      setAnchor({ left: rect.left, top: rect.top, width: rect.width, right: rect.right });
    };

    const syncPreviews = () => {
      if (!form) return;
      const activeNames = getAttachmentNames(form);
      if (activeNames.size === 0) {
        setPreviews((items) => {
          for (const item of items) {
            URL.revokeObjectURL(item.url);
            urls.delete(item.url);
          }
          return [];
        });
        return;
      }

      setPreviews((items) => items.filter((item) => {
        const keep = activeNames.has(item.name);
        if (!keep) {
          URL.revokeObjectURL(item.url);
          urls.delete(item.url);
        }
        return keep;
      }));
    };

    const addPreviews = (files: File[]) => {
      const images = files.filter((file) => file.type.startsWith('image/'));
      if (images.length === 0) return;

      setPreviews((items) => {
        const next = [...items];
        const existingKeys = new Set(items.map((item) => item.key));
        for (const file of images) {
          const key = `${file.name}:${file.size}:${file.lastModified}`;
          if (existingKeys.has(key)) continue;
          const url = URL.createObjectURL(file);
          urls.add(url);
          existingKeys.add(key);
          next.push({ key, name: file.name, url });
        }
        return next.slice(-MAX_ATTACHMENTS);
      });
    };

    const redispatchFiles = async (files: File[], source: 'picker' | 'paste') => {
      if (!input || !form) return;
      const capacity = Math.max(0, MAX_ATTACHMENTS - currentAttachmentCount(form));
      if (capacity === 0) {
        showNotice(`You can attach up to ${MAX_ATTACHMENTS} files.`);
        return;
      }

      const accepted = files.slice(0, capacity);
      if (accepted.length < files.length) {
        showNotice(`Only ${capacity} more attachment${capacity === 1 ? '' : 's'} can be added.`);
      }

      const prepared = await Promise.all(
        accepted.map((file) => file.type.startsWith('image/') ? optimizeImage(file) : Promise.resolve(file)),
      );

      try {
        const transfer = new DataTransfer();
        prepared.forEach((file) => transfer.items.add(file));
        input.dataset.phase15Processed = '1';
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        window.setTimeout(() => {
          if (input) delete input.dataset.phase15Processed;
        }, 0);
        if (source === 'paste') showNotice(`${prepared.length} image${prepared.length === 1 ? '' : 's'} pasted.`);
      } catch {
        showNotice('This browser cannot attach clipboard images automatically.');
      }
    };

    const onChangeCapture = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target !== input || target.type !== 'file') return;
      const files = Array.from(target.files ?? []);
      if (files.length === 0) return;

      if (target.dataset.phase15Processed === '1') {
        addPreviews(files);
        return;
      }

      if (!files.some((file) => file.type.startsWith('image/'))) return;

      event.stopPropagation();
      void redispatchFiles(files, 'picker');
    };

    const onPaste = (event: ClipboardEvent) => {
      const clipboardFiles = Array.from(event.clipboardData?.files ?? [])
        .filter((file) => file.type.startsWith('image/'))
        .map((file, index) => normalizePastedFile(file, index));
      if (clipboardFiles.length === 0) return;

      event.preventDefault();
      void redispatchFiles(clipboardFiles, 'paste');
    };

    const connect = () => {
      input = findChatFileInput();
      form = input?.closest('form') ?? null;
      if (!input || !form) {
        retryTimer = window.setTimeout(connect, 250);
        return;
      }

      document.addEventListener('change', onChangeCapture, true);
      document.addEventListener('paste', onPaste);
      window.addEventListener('resize', updateAnchor);
      window.visualViewport?.addEventListener('resize', updateAnchor);
      window.visualViewport?.addEventListener('scroll', updateAnchor);

      mutationObserver = new MutationObserver(() => {
        syncPreviews();
        updateAnchor();
      });
      mutationObserver.observe(form, { childList: true, subtree: true, characterData: true });

      resizeObserver = new ResizeObserver(updateAnchor);
      resizeObserver.observe(form);
      updateAnchor();
    };

    retryTimer = window.setTimeout(connect, 0);

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      document.removeEventListener('change', onChangeCapture, true);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('resize', updateAnchor);
      window.visualViewport?.removeEventListener('resize', updateAnchor);
      window.visualViewport?.removeEventListener('scroll', updateAnchor);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, [showNotice]);

  const cameraStyle = useMemo(() => {
    if (!anchor) return undefined;
    return {
      left: Math.max(12, anchor.right - 102),
      top: Math.max(68, anchor.top - 42),
    };
  }, [anchor]);

  const previewStyle = useMemo(() => {
    if (!anchor || previews.length === 0) return undefined;
    return {
      left: Math.max(8, anchor.left + 8),
      top: Math.max(70, anchor.top - 102),
      width: Math.max(180, anchor.width - 16),
    };
  }, [anchor, previews.length]);

  const openCamera = () => {
    const input = findChatFileInput();
    if (!input) {
      showNotice('Camera attachment is unavailable right now.');
      return;
    }

    const previousAccept = input.getAttribute('accept');
    const previousCapture = input.getAttribute('capture');
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      if (previousAccept === null) input.removeAttribute('accept');
      else input.setAttribute('accept', previousAccept);
      if (previousCapture === null) input.removeAttribute('capture');
      else input.setAttribute('capture', previousCapture);
      window.removeEventListener('focus', onFocus);
    };
    const onFocus = () => window.setTimeout(restore, 700);

    input.setAttribute('accept', 'image/*');
    input.setAttribute('capture', 'environment');
    input.addEventListener('change', restore, { once: true });
    window.addEventListener('focus', onFocus, { once: true });
    input.click();
  };

  if (!anchor || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={openCamera}
        style={cameraStyle}
        className="sm:hidden fixed z-[70] inline-flex h-8 items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/95 px-2.5 text-[11px] font-semibold text-zinc-700 shadow-md backdrop-blur-md dark:border-zinc-700/90 dark:bg-zinc-900/95 dark:text-zinc-200"
        title="Take a photo"
        aria-label="Take a photo"
      >
        <Camera className="h-3.5 w-3.5" />
        Camera
      </button>

      {previewStyle && (
        <div
          style={previewStyle}
          className="fixed z-[69] flex h-[92px] items-center gap-2 overflow-x-auto rounded-2xl border border-zinc-200/90 bg-white/95 p-2 shadow-lg backdrop-blur-xl dark:border-zinc-800/90 dark:bg-zinc-950/95"
          aria-label="Image attachment previews"
        >
          {previews.map((item) => (
            <div key={item.key} className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
            </div>
          ))}
          <div className="min-w-28 pr-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Preview ready. Remove an image with the × on its attachment chip.
          </div>
        </div>
      )}

      {notice && (
        <div
          style={{
            left: Math.max(12, anchor.left + 10),
            top: Math.max(66, anchor.top - (previews.length > 0 ? 136 : 42)),
          }}
          className="fixed z-[72] inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/95 px-2.5 py-1.5 text-[11px] font-medium text-blue-800 shadow-md backdrop-blur-md dark:border-blue-900/80 dark:bg-blue-950/95 dark:text-blue-200"
          role="status"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          {notice}
        </div>
      )}
    </>,
    document.body,
  );
}
