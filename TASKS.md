# ELITEZ – TASKS.md (plán stavby pro Claude Code)

Zdroj pravdy o rozsahu je `SPEC.md`, pravidla práce jsou v `CLAUDE.md`.
Stavíme **po funkčních celcích (milnících)**. Každý milník musí být na konci **spustitelný a vyzkoušený**, než jdeme dál.
Pořadí je navržené tak, aby se po každém milníku dalo aplikaci ukázat a použít.

---

## Milník 0 – Příprava (dělá vlastník projektu, s pomocí Claude)

Co si musíš zajistit sám:
- [ ] Nainstalovat Node.js (LTS) a Git
- [ ] Účet na GitHubu a prázdný repozitář `elitez` (soukromý)
- [ ] Účet Supabase (nový projekt, region EU – Frankfurt) – zapsat si URL a klíče **mimo repozitář**
- [ ] Účet Vercel (propojit s GitHubem)
- [ ] Účet Resend (e-maily) – později
- [ ] Doména ELITEZ a ověření názvu (domény, sociální sítě, EUIPO)
- [ ] Nainstalovat Claude Code a otevřít v něm složku projektu
- [ ] Vložit do repozitáře `SPEC.md`, `CLAUDE.md`, `TASKS.md` (do složky `docs/` nebo kořene)

**Hotovo, když:** repozitář existuje, Claude Code v něm vidí všechny tři soubory.

---

## Milník 1 – Základ projektu a přihlášení

**Cíl:** prázdná, ale funkční aplikace s přihlášením, nasazená na internet.

Úkoly:
1. Založit Next.js projekt (TypeScript, Tailwind, App Router), PWA základ (manifest, ikony)
2. Nastavit design základ: barvy (černá, žlutá jako akcent, světlé pozadí), písmo, tlačítka, karty
3. Připojit Supabase, nastavit proměnné prostředí (`.env.local`, nikdy v gitu)
4. Přihlášení: e-mail + heslo a Google (Apple později), odhlášení, obnova hesla
5. i18n kostra (cs, en), přepínač jazyka
6. Nasazení na Vercel (testovací adresa)

Obrazovky: úvodní stránka (jen jednoduchá), přihlášení, registrace, obnova hesla.

**Hotovo, když:** nový uživatel se zaregistruje a přihlásí na živé testovací adrese, přepíná cs/en.

**Stav (10. 11. 2026):** ✅ splněno, otestováno na telefonu na https://elitez-cyan.vercel.app
- Hotovo: úkoly 1, 2, 3, 5, 6 a z úkolu 4 přihlášení e-mailem + heslem, odhlášení, obnova hesla
- Zbývá: přihlášení přes Google (úkol 4)

---

## Milník 2 – Profil a garáž

**Cíl:** člen má profil a garáž s auty.

Úkoly:
1. Tabulky `profiles`, `vehicles`, `vehicle_photos`, `vehicle_mods` + **RLS politiky** (vlastník upravuje, ostatní čtou jen veřejné)
2. Profil: jméno, uživatelské jméno, země, město, avatar, bio, viditelnost (veřejný/soukromý)
3. Garáž: přidat/upravit/smazat vozidlo (typ, kategorie, značka, model, rok, motor, výkon, popis, příběh, úpravy)
4. Nahrávání fotek: zmenšení a více velikostí, pořadí, hlavní fotka
5. Viditelnost vozidla (veřejné/soukromé), označení „prodáno“ → archiv bývalých vozidel
6. Veřejná stránka profilu a vozidla (sdílení odkazem)

Obrazovky: můj profil, úprava profilu, moje garáž, detail vozidla, přidat/upravit vozidlo, archiv, veřejný profil.

**Hotovo, když:** uživatel vytvoří auto s fotkami; soukromé auto cizí uživatel neuvidí (ověřit druhým účtem).

**Stav (11. 11. 2026):** ✅ splněno – úkoly 1–6 hotové, otestováno ručně (localhost) a automaticky (`npm run test:db`: soukromé vozidlo, úpravy, fotky i soubory cizí uživatel nevidí).
- Rozhodnutí k profilu a garáži: SPEC.md 5.1a
- Do Milníku 4: `vehicle_has_event_history()` napojit na `event_registrations`

---

## Milník 3 – Eventy a sezóny (administrace)

**Cíl:** ty (jako pořadatel) vytvoříš sezónu s eventy.

Úkoly:
1. Tabulky `organizers`, `seasons`, `events` + RLS (pořadatel spravuje jen své)
2. Role: admin a pořadatel (nastavení ručně v databázi pro začátek)
3. Vytvoření/úprava eventu: název, popis, termín, místo, mapa, země, limit míst, popis selekce, přístup (veřejný/jen Verified/na pozvánky), nastavení výhod Verified (přednost, předstih), uzávěrka
4. Sezóna: seskupení eventů, hromadné založení, **duplikace eventu**
5. Stavy eventu (koncept, zveřejněný, uzavřený)
6. Veřejný seznam a detail eventu (program, místo, mapa, pravidla)

Obrazovky: seznam eventů, detail eventu, administrace pořadatele (seznam, tvorba, úprava), správa sezóny.

**Hotovo, když:** založíš Underground meeting 3 a Tuning show Trojhalí a vidíš je ve veřejném seznamu.

**Stav (11. 11. 2026):** ✅ splněno – úkoly 1–6 hotové; oba eventy založené v Sezóně 2027 a zveřejněné, otestováno ručně (localhost) a automaticky (`npm run test:db`).
- Rozhodnutí k eventům: SPEC.md 5.1b
- Do Milníku 6: pozvaní do RLS eventů na pozvánky (`event_invites`)

---

## Milník 4 – Registrace a schvalování

**Cíl:** nahrazení WordPress formuláře a Gmailu.

Úkoly:
1. Tabulka `event_registrations` + RLS (uživatel vidí své, pořadatel jen svého eventu)
2. Registrace: výběr vozidla z garáže, doplňující údaje, souhlas se zpracováním; u soukromého vozidla jasné upozornění, že ho uvidí pořadatel
3. Logika oken registrace (Verified dříve, ostatní později podle nastavení eventu), kontrola limitu a uzávěrky
4. Pořadatelský přehled žádostí: filtry, fotky, údaje, odznak Verified, interní poznámka
5. Rozhodnutí: schválit / zamítnout (šablona důvodu) / čekací listina; automatické doplnění z listiny
6. Stav registrace u uživatele („Moje registrace“)

Obrazovky: formulář registrace, moje registrace, pořadatel: seznam žádostí a detail žádosti.

**Hotovo, když:** dva testovací účty podají žádost, ty ji schválíš a zamítneš a každý uvidí správný stav; po naplnění limitu jde další na čekací listinu.

**Stav (12. 11. 2026):** ✅ splněno – úkoly 1–6 hotové; otestováno dvěma účty na localhost (schválení, zamítnutí s důvodem, plná kapacita → čekací listina, automatické doplnění) a automaticky (`npm run test:db`).
- Rozhodnutí k registracím: SPEC.md 5.1c
- E-mailové notifikace o změnách stavu: Milník 5

---

## Milník 5 – Notifikace a komunikace

**Cíl:** žádné ruční psaní v Gmailu.

Úkoly:
1. E-maily přes Resend: potvrzení registrace, schválení, zamítnutí, čekací listina, změna stavu
2. Notifikace v aplikaci (zvonek) + základní push (PWA)
3. Hromadná zpráva pořadatele (všem schváleným / jen čekajícím / jen Verified), šablony textů, náhled
4. Export seznamů (CSV a tisknutelné PDF), seznam pro papírové záložní odbavení
5. Frontování a ochrana proti zahlcení (limity odesílání)

**Hotovo, když:** po schválení přijde e-mail, hromadná zpráva dorazí správné skupině, export se otevře v Excelu.

**Stav (11. 11. 2026):** ✅ splněno na localhost – e-maily (přijata, schváleno, hromadná zpráva) dorazily, export do Excelu a tisk fungují; automatické testy (`npm run test:db`, `npm test`).
- Push notifikace odloženy (SPEC 5.1d).
- Zbývá pro ostrý provoz: vlastní doména v Resendu + e-maily přihlašování (Supabase SMTP) přes Resend.
- Navíc: chyby ve formulářích se zobrazují přímo u pole (posun + zaměření) a po chybě se nemažou vyplněné údaje.

---

## Milník 5b – Turba, sledování a Síň slávy

**Cíl:** komunita má důvod se vracet – dávat turba, sledovat garáže, sbírat odznaky.

Úkoly:
1. Turba na fotky a garáže (animace, kdo dal turbo, souhrnná upozornění)
2. Sledování garáží (počet sledujících, upozornění)
3. Síň slávy: obecný systém odznaků (turbo ocenění, Fanoušek, Série, Objevitel, Zakládající člen, unikátní, ruční od admina)
4. Žebříčky (auta, garáže, fanoušci; týden / měsíc / rok / celkem)
5. Garáž snů s „Tohle chci!“ a štítek Petrolhead / Driver

**Hotovo, když:** dva účty si navzájem dají turbo a sledování, přijde souhrnné upozornění, odznak se udělí po dosažení hranice a žebříček ukazuje správné pořadí.

Pravidla: SPEC.md 5.1e

**Stav (12. 11. 2026):** hotovo na localhost, čeká na vyzkoušení se dvěma účty – turba (fotky, garáž) s animací, souhrnná upozornění, sledování, Síň slávy (odznaky + postup), Žebříčky, Garáž snů s „Tohle chci!“, štítek Petrolhead/Driver. Databáze nahraná, `npm run test:db` prošel.


**Rychlá vylepšení (12. 11. 2026, inspirace oblíbenými aplikacemi):** dvojklik na fotku = turbo, QR samolepka garáže/auta (Garáž → QR samolepka), Auto týdne na úvodní stránce, náhledy odkazů při sdílení + tlačítko Sdílet, připomínka denní série a „Dokonči profil“ v Můj účet, přidání eventu do kalendáře (.ics / Google), nabídka „Přidat na plochu“.

**Na později (větší):** Novinky od sledovaných (přehled nových aut a fotek sledovaných garáží), Týdenní shrnutí („tvoje garáž tento týden získala 23 turb“).
---

## Milník 5c – Pořadatelé (přehled a sledování)

**Cíl:** lidé najdou pořadatele, sledují je a nezmeškají jejich akce.

Úkoly:
1. Profil pořadatele: adresa `/o/<slug>`, logo, odkazy, přepínač proběhlých eventů (nastavení pro pořadatele)
2. Stránka Pořadatelé (seznam) + profil s nadcházejícími a proběhlými eventy
3. Sledování pořadatelů (počet sledujících)
4. Upozornění v aplikaci: nový event, otevření registrace, zrušení eventu

**Hotovo, když:** člen začne sledovat pořadatele, pořadatel zveřejní event a člen dostane upozornění ve zvonku.

Pravidla: SPEC.md 5.1f

**Stav (12. 11. 2026):** hotovo na localhost – seznam a profily pořadatelů, sledování, upozornění ve zvonku (nový event, otevření registrace přesně na čas, zrušení), nastavení profilu s logem a odkazy. Databáze nahraná, `npm run test:db` prošel.

---

## Milník 5d – Crew (skupiny členů)

**Cíl:** členové se sdružují do exkluzivních crew, soupeří v žebříčcích a crew může pořádat vlastní srazy.

Úkoly:
1. Databáze: crew (unikátní název, stav schválení), členství (otevřené / se schválením, domovská crew), odznaky crew
2. Založení crew (jen Verified) + admin fronta schvalování
3. Stránka crew `/c/<slug>`, seznam crew, vstup/odchod, správa členů zakladatelem
4. Žebříčky crew (největší, nejaktivnější), odznaky crew
5. Crew jako pořadatel (žádost, schválení, eventy za crew, přístup „jen pro členy crew“, upozornění členům)

**Hotovo, když:** Verified člen založí crew, admin ji schválí, další člen se přidá, crew je v žebříčku a uspořádá sraz jen pro členy.

Pravidla: SPEC.md 5.1g (navazuje na Milník 5c)

**Stav (13. 11. 2026):** část 1 hotová na localhost – úkoly 1–4 (crew, schvalování, stránky, žebříčky a odznaky), přepínač Verified pro admina. Zbývá úkol 5: crew jako pořadatel.

---

## Milník 6 – Verified (členství v klubu)

**Cíl:** prestižní status s ruční kontrolou.

Úkoly:
1. Tabulka `verifications` + **soukromý bucket** pro videa (nikdy veřejný)
2. Žádost: aplikace vygeneruje náhodnou větu/kód s platností, uživatel natočí video (nahrání z telefonu), vyplní odkaz na Instagram (volitelný), souhlas se zpracováním
3. Admin fronta: přehrání videa, kontrola kódu, schválit/zamítnout s důvodem ze šablony
4. Po rozhodnutí **automatické smazání videa** do 30 dnů, zachování výsledku
5. Odznak Verified na profilu a v žádostech na eventech; odebrání statusu adminem
6. Aplikace výhod: přednost, předstih, pozvánky na soukromé eventy

Obrazovky: žádost o Verified, stav žádosti, admin fronta, správa pozvánek na event.

**Hotovo, když:** schválený uživatel dostane odznak, vidí dřívější registraci a pozvánkový event; video se po lhůtě opravdu smaže.

---

## Milník 7 – Check-in a odznaky

**Cíl:** ověřená účast a první „hra“.

Úkoly:
1. QR kód účastníka (v aplikaci, později Wallet)
2. Check-in obrazovka pro pořadatele: skenování kamerou, ruční vyhledání, stav; **funguje offline** (fronta, synchronizace)
3. Tabulky `badges`, `user_badges`, `checkins`; odznak se uděluje **jen po check-inu**
4. Odznaky na profilu a u vozidla (např. „byl na Trojhalí 2027“)
5. Záložní postup: tištěný seznam (z Milníku 5)

**Hotovo, když:** otestuješ v místě bez signálu, check-in se uloží a po připojení synchronizuje, odznak se objeví.

---

## Milník 8 – Příprava na ostrý provoz

Úkoly:
- Právní texty: zásady zpracování osobních údajů, obchodní podmínky, pravidla komunity, souhlasy (provozovatel: tvoje firma)
- Minimální věk 16+ při registraci
- Zálohy databáze, monitoring chyb, rate limity, bezpečnostní kontrola RLS
- Mazání účtu a dat (GDPR)
- Zátěžový a uživatelský test s 10–20 lidmi (včetně telefonů iOS i Android)
- Příprava importu dosavadních účastníků (volitelné)

**Hotovo, když:** malá uzavřená skupina úspěšně projde celým postupem od registrace po check-in.

---

## Po spuštění (v1.5 a dál)

SPOTy a challenge (GPS ověření, hlasování, porota, moderace), slovenština a polština, statistiky pořadatelů, další promotéři, přátelé, bazar, platby a ticketing. Viz `SPEC.md`.

---

## Jak pracovat v Claude Code (návod pro vlastníka)

1. Na začátku každé session řekni: „Přečti `CLAUDE.md`, `SPEC.md` a `TASKS.md`. Pracujeme na milníku X.“
2. Nech Claude Code nejdřív **navrhnout plán** daného milníku a odsouhlas ho.
3. Po každém menším kroku si výsledek **spusť a vyzkoušej** (Claude řekne jak).
4. Funkční stav **ukládej do Gitu** (commit) po každém dokončeném kroku.
5. Když něco nefunguje, vlož přesnou chybovou hlášku.
6. Produktová rozhodnutí vrať do SPEC.md.

### První zadání pro Claude Code (Milník 1)

> Přečti `CLAUDE.md`, `SPEC.md` a `TASKS.md`. Začínáme Milníkem 1. Nejdřív mi česky navrhni plán po krocích, ať ho odsouhlasím. Pak založ Next.js projekt (TypeScript, Tailwind, App Router) s PWA základem, světlým designem (černá a žlutý akcent), připoj Supabase a udělej přihlášení e-mailem. Každý krok stručně vysvětli a řekni, jak ho mám vyzkoušet.

---

## Později – monetizace (kostra, k doladění)

Pravidla a nápady: SPEC.md 13a. Doporučené pořadí: Partneři klubu → Bazar s topováním (+ upozornění pro „Aktivně hledám“ z Garáže snů) → Podporovatel klubu → Pořadatel Pro → vstupenky a fotky z eventů. Předpoklad: Stripe, IČO, obchodní podmínky.
