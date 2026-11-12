-- Milník 5d (část 2): sraz jen pro členy crew + upozornění (zvlášť kvůli použití výčtů)
alter type public.event_access add value if not exists 'crew_only';
alter type public.notification_type add value if not exists 'crew_organizer_request';
alter type public.notification_type add value if not exists 'crew_organizer_approved';
