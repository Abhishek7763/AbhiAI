# Phase 6 image editing provider behavior

Image editing uses configured providers from the same Supabase-backed AI provider/key system used by the rest of AbhiAI.

Provider order in `auto` mode:
1. Google Gemini image editing
2. OpenAI image editing

The service does not silently fall back to text-to-image or Pollinations for edit requests. If no compatible configured provider can edit the uploaded source image, the API returns a specific error for the Image Studio toast/error panel.
