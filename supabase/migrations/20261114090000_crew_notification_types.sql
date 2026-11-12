-- Milník 5d: upozornění pro crew (zvlášť kvůli použití výčtu)
alter type public.notification_type add value if not exists 'crew_review';
alter type public.notification_type add value if not exists 'crew_approved';
alter type public.notification_type add value if not exists 'crew_rejected';
alter type public.notification_type add value if not exists 'crew_join_request';
alter type public.notification_type add value if not exists 'crew_member_approved';
