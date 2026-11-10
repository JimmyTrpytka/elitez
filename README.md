# ELITEZ

Klub a platforma pro automobilovou komunitu. Rozsah: `SPEC.md`, plán: `TASKS.md`, pravidla: `CLAUDE.md`.

## Spuštění na vlastním počítači

```bash
npm install
npm run dev
```

Pak otevři http://localhost:3000

## Nastavení Supabase (jednou)

1. Zkopíruj `.env.example` do `.env.local` (už je připravený) a doplň:
   - `NEXT_PUBLIC_SUPABASE_URL` – Supabase → Project Settings → Data API → Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` – Supabase → Project Settings → API Keys → Publishable key (nebo starší „anon“)
   - **Nikdy** sem nedávej „secret“ / „service_role“ klíč. `.env.local` se do gitu neukládá.
2. V Supabase → Authentication → URL Configuration:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** přidej `http://localhost:3000/**`
3. Po změně `.env.local` restartuj `npm run dev`.

## Příkazy

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | vývojový server |
| `npm run lint` | kontrola kódu |
| `npm run build` | zkušební sestavení (odhalí chyby před nasazením) |

## Struktura

```
src/app            stránky ([locale] = jazyk v adrese /cs, /en)
src/components     UI komponenty (ui/ = tlačítka, karty, pole)
src/lib            Supabase klient, přihlášení
src/i18n           jazyky a překlady (messages/cs.json, en.json)
src/proxy.ts       jazyk v adrese + obnova přihlášení
supabase/migrations  databázové migrace
```
