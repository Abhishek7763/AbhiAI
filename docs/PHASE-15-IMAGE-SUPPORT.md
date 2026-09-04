# Phase 15 — Image Support

Status: **Complete on `improve/abhiai-stability`**

## Delivered

- Existing chat image/file upload kept intact.
- Clipboard image paste support added to the public composer.
- Mobile rear-camera capture shortcut added without replacing normal file upload.
- Real image thumbnails are shown before sending.
- Oversized camera/pasted images are client-optimized before inline chat upload.
- Existing server attachment limits remain authoritative: up to four inline attachments and the existing combined-size guard.
- Vision routing is now capability-aware instead of Google-only for images.
- PDF/native document routing remains Gemini-only so document layout, tables and embedded images are preserved.
- OpenAI-compatible streaming/non-streaming adapters receive image attachments when the selected runtime model is vision-capable.
- Existing image-generation gateway is retained as the generation adapter layer (Gemini image, OpenAI image, Stability, custom endpoint and Pollinations/Flux fallback) with moderation, Free Guard, usage logging and optional Supabase persistence.

## Safety and compatibility

- Existing text chat, streaming, failover, runtime health, web search, telemetry and auth flows are preserved.
- Manual selection of a text-only model with an image falls back to a compatible vision model instead of sending unsupported image content.
- PDF requests do not spill into generic OpenAI-compatible providers.
- Clipboard/camera helpers reuse the existing chat file input and server validation; no new public upload endpoint is exposed.

## Completion gate

Phase 15 is complete when the repository Verify workflow passes on the Phase 15 commit:

1. TypeScript typecheck
2. ESLint
3. Node tests, including vision capability routing coverage
4. Next.js production build

No production `main` merge is part of this phase.
