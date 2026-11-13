-- Upozornění pro spolupořádání eventů (samostatně kvůli enumu)
alter type public.notification_type add value if not exists 'cohost_request';
alter type public.notification_type add value if not exists 'cohost_invite';
alter type public.notification_type add value if not exists 'cohost_accepted';
