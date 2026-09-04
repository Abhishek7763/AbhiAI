'use client';

import { useEffect, useState } from 'react';
import { Bell, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { requestBackgroundAlertPermission } from '@/lib/pwa/client';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'abhiai_pwa_install_dismissed_at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function ServiceWorkerRegistration() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if ('Notification' in window) setNotificationPermission(Notification.permission);
    else setNotificationPermission('unsupported');

    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        logger.debug('Service worker registered.');

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (error) {
        logger.warn('Service worker registration failed.', error);
      }
    };

    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isStandalone()) return;

      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return;

      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowInstallCard(true);
    };

    const onAppInstalled = () => {
      setInstallEvent(null);
      setShowInstallCard(false);
      localStorage.removeItem(DISMISS_KEY);
      toast.success('AbhiAI installed');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('load', register);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const result = await installEvent.userChoice;
      if (result.outcome === 'accepted') {
        setShowInstallCard(false);
        setInstallEvent(null);
      }
    } catch (error) {
      logger.warn('PWA install prompt failed.', error);
      toast.error('Could not open the install prompt.');
    }
  };

  const enableAlerts = async () => {
    const permission = await requestBackgroundAlertPermission();
    if (permission === 'unsupported') {
      toast.error('Notifications are not supported in this browser.');
      return;
    }

    setNotificationPermission(permission);
    if (permission === 'granted') toast.success('Background completion alerts enabled');
    else if (permission === 'denied') toast.error('Notifications are blocked in browser settings.');
  };

  const dismissInstallCard = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowInstallCard(false);
  };

  if (!showInstallCard || !installEvent) return null;

  return (
    <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[70] sm:left-auto sm:right-5 sm:w-[390px]">
      <div className="rounded-3xl border border-zinc-200/90 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-zinc-950 dark:text-zinc-50">Install AbhiAI</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Open faster, keep recently viewed chats available offline, and get completion alerts.</p>
              </div>
              <button type="button" onClick={dismissInstallCard} className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Dismiss install prompt">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void installApp()} className="rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white transition active:scale-[0.98] dark:bg-white dark:text-zinc-950">
                Install app
              </button>
              {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                <button type="button" onClick={() => void enableAlerts()} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition active:scale-[0.98] dark:border-zinc-800 dark:text-zinc-200">
                  <Bell className="h-3.5 w-3.5" /> Enable alerts
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
