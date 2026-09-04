# Phase 6 verification checklist

- Generate a normal text-to-image result with no reference image.
- Upload a PNG/JPEG/WebP reference image and verify Edit mode activates.
- With a configured Gemini/OpenAI image provider and free-only mode disabled, submit an edit and verify a new result appears.
- Upload an optional mask and verify the edit request still completes on a compatible provider.
- Switch among 1:1, 16:9, 9:16, 4:3 and 3:4 ratios.
- Use Variation from preview and gallery and verify it returns to Create with a variation prompt.
- Sign in, generate/edit an image, reopen Image Studio and verify cloud history is loaded.
- Verify private Storage-backed images render through signed URLs.
- Trigger a provider failure and verify a specific toast/error message is shown.
- Run `npm run verify` before merge and verify Vercel preview deployment.
