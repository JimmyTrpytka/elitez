-- Milník 5c: upozornění sledujícím pořadatele (zvlášť kvůli použití výčtu)
alter type public.notification_type add value if not exists 'organizer_event_published';
alter type public.notification_type add value if not exists 'organizer_registration_open';
alter type public.notification_type add value if not exists 'organizer_event_cancelled';
