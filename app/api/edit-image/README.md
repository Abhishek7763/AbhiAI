# Edit Image API

`POST /api/edit-image`

JSON body:
- `prompt`: edit instruction
- `sourceImage`: PNG/JPEG/WebP data URL, maximum 10 MB
- `maskImage`: optional PNG/JPEG/WebP data URL for provider-supported inpainting
- `aspectRatio`: output ratio
- `style`: image style metadata
- `engine`: `auto`, `imagen`, `openai`, or `dalle`

The route uses the same public AI request guard as image generation and uses configured encrypted provider keys from Supabase. Edit mode intentionally does not fall back to Pollinations or text-to-image.
