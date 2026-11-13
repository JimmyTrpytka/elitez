-- Spolupořadatelé a správci crew: upozornění (zvlášť kvůli použití výčtu)
alter type public.notification_type add value if not exists 'organizer_member_added';
alter type public.notification_type add value if not exists 'crew_admin_added';
