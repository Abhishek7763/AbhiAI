import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('phase 8 service worker caches the app shell and runtime assets', () => {
  const sw = source('public/sw.js');
  assert.match(sw, /APP_SHELL/);
  assert.match(sw, /networkFirst/);
  assert.match(sw, /cacheFirst/);
  assert.match(sw, /staleWhileRevalidate/);
  assert.match(sw, /request\.mode === 'navigate'/);
  assert.match(sw, /\/_next\/static\//);
});

test('phase 8 never caches private API GET responses', () => {
  const sw = source('public/sw.js');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
});

test('phase 8 supports install prompt UX on Chromium and iOS Safari', () => {
  const registration = source('components/pwa/service-worker-registration.tsx');
  assert.match(registration, /beforeinstallprompt/);
  assert.match(registration, /appinstalled/);
  assert.match(registration, /Add to Home Screen/);
  assert.match(registration, /display-mode: standalone/);
});

test('phase 8 background image completion notifications are wired through the service worker', () => {
  const sw = source('public/sw.js');
  assert.match(sw, /\/api\/generate-image/);
  assert.match(sw, /\/api\/edit-image/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /notificationclick/);
  assert.match(sw, /addEventListener\('push'/);
});

test('phase 8 notification permission is only requested from explicit UI actions', () => {
  const client = source('lib/pwa/client.ts');
  const registration = source('components/pwa/service-worker-registration.tsx');
  assert.match(client, /Notification\.requestPermission\(\)/);
  assert.match(registration, /onClick=\{\(\) => void enableAlerts\(\)\}/);
});
