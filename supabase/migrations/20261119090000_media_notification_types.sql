-- Upozornění pro mediální přihlášky (samostatně – nové hodnoty enumu
-- nejdou použít ve stejné transakci, kde se přidaly)
alter type public.notification_type add value if not exists 'media_approved';
alter type public.notification_type add value if not exists 'media_rejected';
