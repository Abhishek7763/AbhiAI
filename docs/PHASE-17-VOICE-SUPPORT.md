# Phase 17 — Voice Support

Status: **Implemented on `improve/abhiai-stability`; completion requires Verify CI success.**

## Scope from the master plan

- Microphone input
- Speech-to-text
- TTS / read aloud
- Voice controls

Acceptance criterion: **Basic voice conversation experience works.**

## Delivered

### Voice dictation

- Browser-native Speech Recognition support is wired into the existing chat composer microphone control.
- Recognition uses the browser/device language rather than forcing English.
- Interim speech is tracked separately and only final recognition results are committed to the composer, preventing repeated/duplicated dictation text.
- Permission, microphone, no-speech, and temporary recognition failures now have explicit client-side handling.
- Browsers without compatible speech recognition keep the normal text chat path intact.

### Read aloud / TTS

- Assistant responses retain the existing **Listen / Stop Audio** control.
- Markdown, links, fenced code, HTML noise, and image markup are normalized before speech so responses sound natural.
- Speech language is detected for common Indian scripts (including Hindi/Devanagari) with the browser locale as the fallback.
- The browser's best matching voice is selected when available; otherwise the platform default voice is used.
- Speech is cancelled safely when the component unmounts or the user stops playback.

### AbhiAI Voice Mode

- The existing Voice Mode control no longer depends on a custom inbound WebSocket server, which is not a reliable requirement for the normal Vercel Next.js deployment path.
- Voice Mode now runs as a browser speech loop:
  1. microphone speech recognition,
  2. the existing same-origin `/api/chat/stream` endpoint,
  3. AbhiAI smart routing / failover / guards / usage handling,
  4. browser text-to-speech playback,
  5. automatic listening restart for the next turn.
- The voice session keeps a small bounded conversational history so follow-up voice questions preserve context without growing indefinitely.
- Ending Voice Mode aborts active network work, microphone recognition, and speech playback.
- Unsupported browsers and blocked microphone permissions show a visible Voice Mode error instead of failing silently.

## Safety and compatibility

- No new public voice API endpoint was added.
- No additional provider key is exposed to the browser.
- Existing chat streaming, web search, image/document attachments, failover/cooldown, telemetry, Free Guard, local chat history, encrypted provider keys, and admin authentication remain unchanged.
- Standard typed chat continues to work even when browser voice capabilities are unavailable.

## Automated coverage

`tests/voice.test.mts` verifies:

1. speech text cleanup removes markdown/code noise while preserving readable content,
2. Devanagari text selects Hindi speech,
3. Latin text retains the browser language fallback.

## Completion gate

Phase 17 is complete when the repository Verify workflow succeeds on the Phase 17 commit:

1. TypeScript typecheck
2. ESLint
3. Node tests
4. Next.js production build

No production `main` merge is part of this phase.
