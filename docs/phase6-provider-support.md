# Phase 6 provider support

Text-to-image continues to use the existing configured-provider routing.

Image editing supports:
- Google Gemini image-capable provider
- OpenAI GPT Image provider

The edit route returns an explicit error when only non-edit-capable/free fallback providers are available. This avoids silently generating an unrelated new image when the user asked to modify an existing one.
