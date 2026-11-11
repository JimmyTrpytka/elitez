# CLAUDE.md – pravidla projektu ELITEZ

## Co projekt je
ELITEZ je mezinárodní **klub** a platforma pro automobilovou komunitu (tuning, youngtimery, americká auta, veteráni, motorky): garáž, eventy s registrací a schvalováním pořadatelem, odznaky za účast, status Verified, později SPOTy/challenge a bazar.
ELITEZ není pořadatel. Eventy pořádají promotéři (zpočátku vlastník projektu).
Podrobnosti jsou v `SPEC.md` (zdroj pravdy o rozsahu). Před každým větším úkolem si ho přečti.

## Důležité o uživateli
Vlastník projektu **není programátor**. Proto:
- Vysvětluj kroky srozumitelně a česky, bez zbytečného žargonu.
- Před větší změnou stručně řekni, co a proč uděláš.
- Dělej **malé kroky**, po každém spusť aplikaci/testy a řekni, jak si výsledek vyzkoušet.
- Nic nenasazuj ani nemaž bez výslovného souhlasu. Žádné destruktivní příkazy (reset databáze, force push) bez potvrzení.
- Nikdy nevkládej tajné klíče do kódu ani do gitu.

## Technologie
- Next.js (App Router) + TypeScript + Tailwind CSS, PWA
- Supabase (PostgreSQL, Auth, Storage, Row Level Security)
- E-maily: Resend. Mapy: MapLibre/OpenStreetMap
- i18n od začátku (čeština, angličtina; texty nikdy natvrdo v komponentách)

## Pravidla pro kód
- TypeScript striktně, žádné `any` bez důvodu.
- Databázové změny **jen přes migrace** ve složce `supabase/migrations`.
- **Row Level Security zapnutá na každé tabulce.** Každá nová tabulka musí mít politiky ještě před použitím.
- Oprávnění vždy kontroluj na serveru/databázi, nikdy jen v UI.
- Garáž a vozidla mají viditelnost **public / private**; respektuj ji v každém dotazu i v politikách RLS. Prodaná vozidla se archivují, nemažou.
- Status **Verified** uděluje jen admin; uživatel si ho nesmí změnit sám.
- Soukromé vozidlo přihlášené na event vidí jen pořadatel tohoto eventu, dokud majitel nepovolí zveřejnění.
- Eventy mají přístup **public / verified_only / invite_only** a oddělená okna registrace pro Verified a ostatní. Pozvánkové eventy jsou pro nepozvané neviditelné (i v API/RLS).
- Pořadatel vidí a spravuje **jen své eventy** (model je připravený na více pořadatelů, i když zpočátku je jen jeden).
- Soukromá data (videa pro Verified, e-maily, přesné údaje) nesmí být veřejně čitelná. Videa jsou v soukromém bucketu a po ověření se mažou.
- Fotky se při nahrání zmenšují a ukládají ve více velikostech (řízení nákladů).
- Žádné fotky SPZ nesmí být zveřejněné (viz SPEC).
- Peníze/ticketing ve v1 neřešíme. Nepřidávej platby bez zadání.

## Design
- Světlý, minimalistický, moderní (styl Apple), luxusní nádech, obsah před formou.
- Černá + žlutá: žlutá je **akcent** (tlačítka, odznaky). Na bílém pozadí **nikdy žlutý text** (kontrast); na žlutých plochách černý text.
- Velké fotky aut, hodně prázdného místa, čistý bezpatkový font.
- Mobil na prvním místě (většina uživatelů bude na telefonu).

## Struktura projektu (návrh)
```
/src/app            stránky a routy
/src/components     UI komponenty
/src/lib            pomocné funkce, klient Supabase
/src/i18n           překlady (cs, en)
/supabase/migrations  databázové migrace
/docs               SPEC, rozhodnutí, poznámky
```

## Postup práce
1. Před úkolem: přečti `SPEC.md`, shrň plán, počkej na souhlas u větších změn.
2. Implementuj po malých částech, spusť `npm run lint` a testy.
3. Po dokončení: stručně popiš, co se změnilo, jak to vyzkoušet a co zbývá.
4. Při nejasnosti produktového rozhodnutí **zeptej se**, neodhaduj.
5. Změny rozsahu zapisuj do `SPEC.md`.

## Příkazy
- Vývoj: `npm run dev`
- Kontrola kódu: `npm run lint`
- Sestavení (odhalí i chyby typů): `npm run build`
- Testy: `npm test` (unit testy, Vitest) a `npm run test:db` (test pravidel RLS proti databázi, vše se vrací rollbackem)
- Migrace do databáze: `npm run db:push` (Supabase CLI, projekt je propojený přes `supabase link`)
- Typy z databáze po migraci: `npm run db:types` → `src/lib/supabase/database.types.ts`

## Technické poznámky (Milník 1)
- Next.js 16: „middleware“ se jmenuje `src/proxy.ts`. Zapnuté `cacheComponents` – cokoli, co čte cookies/přihlášení nebo parametry adresy, musí být uvnitř `<Suspense>`.
- Překlady: `next-intl`, jazyk z adresy přes `next/root-params`. Serverové akce nemůžou číst jazyk z adresy – posílej ho skrytým polem `locale` a vracej klíč chyby, text přeloží formulář.
- Supabase: `src/lib/supabase/server.ts` (server), `src/lib/supabase/proxy.ts` (obnova přihlášení). Přihlášeného uživatele zjišťuj přes `getCurrentUser()` v `src/lib/auth/user.ts`.

## Technické poznámky (Milník 2)
- Úložiště `avatars` a `vehicle-photos` jsou SOUKROMÁ; obrázky se zobrazují přes podepsané odkazy (`signFiles` v `src/lib/storage.ts`), které Supabase vydá jen při splnění RLS.
- Fotky se zmenšují v prohlížeči (`src/lib/images/resize.ts`) do sm/md/lg; Safari neumí WebP → JPEG (`vehicle_photos.format`). Cesta: `{vehicle_id}/{photo_id}-{size}.{format}`.
- `public.vehicle_has_event_history()` vrací zatím `false`; v Milníku 4 ji přepiš na kontrolu `event_registrations` (blokuje mazání vozidel z eventů).
- Při úpravě RLS doplň případ do `supabase/tests/rls_test.sql`.

## Technické poznámky (Milník 3)
- Oprávnění pořadatele: `public.my_organizer_ids()` (jen schválení) a `public.is_admin()`; obě security definer. Stav pořadatele mění jen admin funkcí `admin_set_organizer_status`.
- Event na pozvánky (`invite_only`) je v RLS viditelný jen pořadateli – v Milníku 6 doplň pozvané (`event_invites`) do politiky `events: read visible` i do úložiště `event-images`.
- Časy: v DB UTC, ve formulářích a zobrazení `src/lib/dates.ts` (Europe/Prague). `registration_verified_opens_at` počítá trigger z předstihu.
- Účet `gastoys` je admin a pořadatel „ELITEZ“ (nastaveno ručně SQL, ne migrací).
- Po `npm run build` při běžícím `npm run dev` může dev server držet staré překlady – restartuj ho.

## Technické poznámky (Milník 4)
- Do `event_registrations` aplikace NEZAPISUJE přímo (práva odebraná). Vše přes funkce `register_for_event`, `cancel_registration`, `decide_registration` (security definer, zamykají event kvůli kapacitě). Chyby vrací jako text výjimky → `RegistrationErrors` v překladech.
- Čekací listinu doplňuje `fill_from_waitlist` (jen při nastavené kapacitě; Verified první při `verified_priority`).
- Interní poznámky pořadatele jsou v samostatné tabulce `event_registration_notes` (uchazeč nemá přístup).
- Pořadatel vidí soukromé vozidlo a profil uchazeče přes politiky „organizer reads applicants“.
- Zobrazení stavu registrace: `src/lib/registration-window.ts` (stejná pravidla jako v DB, jen pro UI).
- E-mailové notifikace o změně stavu přijdou v Milníku 5.

## Technické poznámky (Milník 5)
- Změna stavu přihlášky → trigger `registration_status_notify` → `enqueue_user_message` zapíše upozornění (`notifications`) a e-mail do fronty (`email_outbox`). Hromadné zprávy přes `send_broadcast` (limit 5/event/24 h).
- Frontu odesílá `processEmailOutbox()` (`src/lib/email/outbox.ts`) přes Resend batch API – volá se přes `after()` po akcích a denně cronem `/api/cron/emails` (vercel.json, chráněno `CRON_SECRET`). Hlídá `EMAIL_DAILY_LIMIT`.
- Fronta potřebuje `SUPABASE_SECRET_KEY` (jen server, `src/lib/supabase/admin.ts`) – funkce `claim_email_batch`/`complete_email`/`fail_email` smí volat jen service_role.
- Šablony e-mailů: `src/lib/email/render.ts`, texty v překladech (`Email`). Uživatelský text se vždy escapuje. V ICU textech piš doslovné složené závorky jako `'{jmeno}'`.
- Export CSV: `/api/organizer/events/[id]/export` (UTF-8 BOM, středníky). Tisková stránka `/organizer/events/[id]/print`; hlavička a patička mají `print:hidden`.
- Unit testy: `vitest.config.ts` (alias `@`).
