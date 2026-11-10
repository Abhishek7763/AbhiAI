insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-images',
  'generated-images',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists generated_images_storage_select on storage.objects;
create policy generated_images_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists generated_images_storage_insert on storage.objects;
create policy generated_images_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists generated_images_storage_update on storage.objects;
create policy generated_images_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists generated_images_storage_delete on storage.objects;
create policy generated_images_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
