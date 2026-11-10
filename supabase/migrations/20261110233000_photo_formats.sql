-- Safari (iPhone) neumí v prohlížeči uložit obrázek jako WebP.
-- Proto povolujeme i JPEG a u fotek si pamatujeme, v jakém formátu jsou.

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg']
where id in ('avatars', 'vehicle-photos');

alter table public.vehicle_photos
  add column format text not null default 'webp'
    check (format in ('webp', 'jpg'));
