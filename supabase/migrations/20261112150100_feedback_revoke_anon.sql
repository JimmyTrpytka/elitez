-- Návštěvník (anon) nemá k tabulce připomínek vůbec přístup
revoke select on public.feedback from anon;
