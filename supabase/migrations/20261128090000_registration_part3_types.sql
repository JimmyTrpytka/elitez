-- Registrace – část 3: nové typy upozornění (musí být v samostatné migraci,
-- nová hodnota výčtu se nedá použít ve stejné transakci)
alter type public.notification_type add value if not exists 'registration_info_requested';
alter type public.notification_type add value if not exists 'registration_info_provided';
