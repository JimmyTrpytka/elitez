-- Nové typy upozornění pro žádosti o akreditaci médií
-- (samostatná migrace – nové hodnoty výčtu nejde použít ve stejné transakci)
alter type public.notification_type add value if not exists 'media_request_received';
alter type public.notification_type add value if not exists 'media_requested';
