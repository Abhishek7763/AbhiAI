# Phase 6 — Image Generation Enhancements

Implemented on branch `phase-6-image-generation-enhancements`.

## Included

- Image-to-image editing endpoint with configured Gemini/OpenAI providers.
- Optional inpainting mask support for providers that accept masks.
- Expanded aspect ratios and provider selection in Image Studio.
- Generation history synced from the existing Supabase `generated_images` table for signed-in users.
- Private Supabase Storage images are resolved through short-lived signed URLs.
- Variation/remix actions from current preview and gallery.
- Edit-from-history flow when the browser can load the source image.
- Clear user-facing provider/edit errors through the existing Sonner toast system.
- Existing text-to-image flow and `ImageGeneratorModal` public props preserved.

## Notes

- Edit mode requires a configured Gemini or OpenAI image provider and is intentionally unavailable in free-only mode.
- Source and mask uploads accept PNG/JPEG/WebP up to 10 MB.
- No Phase 6 schema migration is required because Phase 3 already created `generated_images` and the private `generated-images` bucket with ownership RLS policies.
