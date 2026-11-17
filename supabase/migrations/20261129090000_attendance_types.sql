-- Registrace – část 4: typ upozornění pro výzvu k potvrzení účasti
-- (samostatná migrace – nová hodnota výčtu se nedá použít ve stejné transakci)
alter type public.notification_type add value if not exists 'attendance_confirm_request';
