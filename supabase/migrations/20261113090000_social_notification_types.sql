-- Milník 5b: nové druhy upozornění (zvlášť, protože nová hodnota výčtu
-- se nedá použít ve stejné transakci, ve které vznikla).
alter type public.notification_type add value if not exists 'turbo_received';
alter type public.notification_type add value if not exists 'new_follower';
alter type public.notification_type add value if not exists 'badge_awarded';
