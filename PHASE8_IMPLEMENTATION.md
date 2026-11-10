# Phase 8 — PWA / Offline

## Built

- Real service worker caching for the app shell, Next.js static assets, fonts, styles and images.
- Network-first navigation with cached fallback so previously loaded AbhiAI can open offline.
- API responses are intentionally excluded from runtime caching to avoid storing private server data in Cache Storage.
- Existing local chat history remains readable offline once the app shell has been visited and cached.
- Install prompt UX for Chromium/Android using `beforeinstallprompt`.
- iOS Safari install guidance using the Share → Add to Home Screen flow.
- Seven-day dismiss cooldown so install/notification cards do not repeatedly interrupt users.
- Explicit background alert permission UI; notification permission is never requested automatically.
- Background completion notifications for Image Studio generation/edit requests when no AbhiAI window is visible.
- Service worker `push` and `notificationclick` handlers, providing the browser-side foundation for future server-originated Web Push jobs.
- Regression tests covering caching, privacy exclusions, install UX and notifications.

## Offline behavior

After at least one successful online visit, the service worker keeps the application shell and runtime assets available. Chat content that already exists in AbhiAI's local history can therefore be opened for reading without a network connection. New AI requests still require connectivity.

## Background completion alerts

When the user explicitly enables notifications, image generation/edit requests passing through the service worker can show a completion notification if AbhiAI is in the background. Clicking the notification focuses or opens AbhiAI.

The service worker also supports incoming `push` events. A future server-side job queue can use that hook for notifications after the browser/app has been fully closed; the current image APIs are synchronous request/response jobs, so Phase 8 does not introduce a new queue infrastructure.

## Security / privacy

- No `/api/*` GET response is cached.
- Only same-origin public static assets and navigation responses are cached.
- Notification permission is user-initiated.
- No new environment variables or secrets are required.
