# Generated Images API

`GET /api/generated-images` returns the signed-in user's recent generated-image history using existing Supabase RLS.

`DELETE /api/generated-images` removes the signed-in user's generated-image metadata and attempts to remove associated private Storage objects.

Guests receive an empty history from GET and a 401 from DELETE.
