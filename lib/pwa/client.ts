'use client';

import { logger } from '@/lib/logger';

export async function getServiceWorkerRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    logger.warn('Could not get the active service worker registration.', error);
    return null;
  }
}

export async function requestBackgroundAlertPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported' as const;
  if (Notification.permission === 'granted') return 'granted' as const;
  if (Notification.permission === 'denied') return 'denied' as const;

  try {
    return await Notification.requestPermission();
  } catch (error) {
    logger.warn('Notification permission request failed.', error);
    return 'denied' as const;
  }
}

export async function notifyGenerationComplete(options: {
  title?: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') return false;
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return false;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;

  try {
    await registration.showNotification(options.title || 'AbhiAI is ready', {
      body: options.body,
      icon: '/branding/abhiai-app-icon-light-512.png?v=20260904b',
      badge: '/branding/abhiai-app-icon-light-512.png?v=20260904b',
      tag: options.tag || 'abhiai-generation-complete',
      data: { url: options.url || '/' },
      renotify: true,
    });
    return true;
  } catch (error) {
    logger.warn('Background completion notification failed.', error);
    return false;
  }
}
