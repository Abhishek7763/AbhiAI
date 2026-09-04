# Phase 6 cloud history

Signed-in users load their latest generated images from the existing `generated_images` table. Storage-backed records are converted to one-hour signed URLs server-side. Guest users continue to use local browser history only.

Clearing history removes local history and, for authenticated users, deletes their own database rows and associated private Storage objects under existing RLS ownership policies.
