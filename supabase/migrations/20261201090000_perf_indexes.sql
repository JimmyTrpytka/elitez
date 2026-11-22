-- Audit výkonu (22. 11. 2026): indexy pro cizí klíče, podle kterých se hledá
-- nebo maže ve větším. Bez nich by s tisíci přihlášek zpomalovalo:
--  - historie auta na eventech / mazání vozidla (event_registrations.vehicle_id)
--  - mazání přihlášky → dohledání jejích upozornění (notifications.registration_id)
create index if not exists event_registrations_vehicle_idx
  on public.event_registrations (vehicle_id);

create index if not exists notifications_registration_idx
  on public.notifications (registration_id)
  where registration_id is not null;
