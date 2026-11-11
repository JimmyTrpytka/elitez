# ELITEZ – SPEC (verze 0.6)

> Stav: návrh k úpravě. Rozhodnutí označená **[POTVRDIT]** čekají na schválení.

## 1. Vize

ELITEZ je mezinárodní **klub a platforma pro celou automobilovou komunitu**: tuning, youngtimery, americké vozy, veterány, klasiky i motorky.

**ELITEZ je klub, ne pořadatel.** Klub a aplikaci provozuje **tvoje firma** (provozovatel a správce osobních údajů). Eventy pořádají promotéři (zpočátku ty, jako promotér Tuning show Trojhalí a Underground meeting). ELITEZ je platforma a komunita, která je spojuje.
Spojuje tři věci jedním profilem auta:

1. **Garáž** – každý člen má profil a v něm svá auta.
2. **Eventy** – auto se hlásí na srazy, pořadatel auta schvaluje, komunikuje s účastníky a eviduje účast.
3. **Hra a komunita** – odznaky za účast, SPOTy a challenge s fotkami aut, soutěže po zemích a v rámci Evropy.

Bazar a monetizace (topování inzerátů, reklama) jsou plánované, ale **nejsou součástí prvních verzí**.

Princip designu: **obsah vítězí nad formou**.

## 2. Referenční případ

**Tuning show Trojhalí** – industriální prostředí, cca 200 vozů z pečlivé selekce, sekce Model Expo a Custom Bike Show.
Další ročník: **19.–20. 6. 2027**.

**Eventy sezóny 2027 (počáteční data):**
1. **Underground meeting 3** – 15. 5. 2027
2. **Tuning show Trojhalí** – 19.–20. 6. 2027

Současný stav (WordPress formulář + Gmail): žádná databáze propojená s ničím, žádné notifikace, žádné potvrzování.

Aplikace ale musí být **obecná** – Trojhalí je jen první event, ne pevně zadrátovaná logika.
Model Expo a Custom Bike Show se ve v1 neřeší. Pokud na ně bude potřeba registrace, vedou se jako **samostatný event**.
Pořadatel zakládá **celou sezonu najednou** (více eventů pod jednou sezonou).

## 3. Cílová skupina a trhy

- Start: **ČR a SK** (největší komunita), následně **Polsko**, pak zbytek Evropy.
- Jazyky v1: **čeština, angličtina** (slovenština je blízko češtiny, ale texty UI se stejně připraví přes i18n). Polština ve v2.
- Aplikace je od začátku vícejazyčná (i18n) a vícezemová (každý uživatel, event a spot má `country`).

## 4. Role

| Role | Popis |
|---|---|
| Návštěvník | Neregistrovaný, vidí veřejné eventy |
| Člen | Kdokoli si může založit profil a garáž. Hlásí vozidla na eventy, sbírá odznaky. Může požádat o status **Verified** |
| Verified člen | Ověřený člen klubu ELITEZ, má výhody (viz 5.1) |
| Pořadatel (promotér) | Schválený účet. Zakládá a spravuje své eventy a sezóny. **Ve v1 jediný pořadatel: ty**, později schválení další promotéři, kteří se přidají do klubu |
| Admin ELITEZ | Provozuje klub: schvaluje žádosti o Verified a nové promotéry, moderuje obsah, řeší nahlášení |

**Zakládání eventů je zpočátku jen pro tebe.** Datový model a oprávnění ale od začátku počítají s více pořadateli (každý vidí a spravuje jen své eventy), aby šlo později přidat další promotéry bez přepisování.

## 5. Klíčová pravidla (rozhodnutí)

### 5.1 Garáž, Verified a schvalování na eventy

**Garáž**
- Profil a garáž si může založit **kdokoli**, bez schvalování.
- Garáž je **osobní databáze vozidel** uživatele: může mít více aut/motorek, průběžně je měnit, kupovat a prodávat. Prodané vozidlo se přesune do **archivu („bývalá auta“)** a historie zůstává součástí profilu.
- **Viditelnost** určuje majitel: **veřejná / soukromá**. Nastavuje se na profilu a zvlášť u každého vozidla. („Jen pro přátele“ je odloženo na později.)
- **Soukromý projekt lze přihlásit na event.** Údaje o něm vidí jen pořadatel eventu pro účely schvalování. Na veřejné stránce eventu ani v garáži se nezobrazí, dokud to majitel nepovolí. Uživatel o tom musí být při registraci jasně informován.
- Podporovaná vozidla: tuning, youngtimery, americká auta, veteráni, klasiky, motorky.

**Verified = členství v klubu ELITEZ**
- Verified je **prestižní status**, ne samozřejmost. Uživatel o něj žádá a o udělení rozhoduje admin klubu.
- Verified se vztahuje na **člověka** (účet), ne na konkrétní auto.
- Postup: uživatel natočí krátké video u svého auta a řekne **náhodně vygenerovanou větu/kód** zobrazený v aplikaci (kód platí omezenou dobu). Admin zkontroluje video a rozhodne.
- Video je soukromé, po rozhodnutí se **smaže** (např. do 30 dnů), uchová se jen výsledek.
- **Kritéria udělení (v1):**
  1. ověřená osoba (video s náhodnou větou u vlastního auta)
  2. zajímavé auto (posuzuje admin; jde o kvalitu a zajímavost projektu, ne o hodnotu)
  3. případně **veřejný profil na Instagramu** (volitelný doplněk, odkaz zadá uživatel, kontroluje se ručně, bez propojení API)
- Kritéria musí být **veřejně napsaná** a zamítnutí se komunikuje zdvořilou šablonou s možností požádat znovu.
- Status lze odebrat při porušení pravidel klubu.

**Výhody Verified (v1):**
- odznak a označení profilu
- **přednost při schvalování** na eventech (pořadatel ho vidí a při selekci ho upřednostní)
- **dřívější přístup k registraci** (pokud ho pořadatel u eventu zapne; délku předstihu určuje pořadatel)
- **speciální pozvánky** na soukromé a kapacitně omezené eventy
- další výhody (partneři, slevy, exkluzivní challenge) později

**Schvalování na eventy**
- **Přihlásit se může kdokoli** s libovolným vozidlem z garáže.
- O přijetí rozhoduje **pořadatel eventu** (schválit / zamítnout / čekací listina).
- Pořadatel u žádosti vidí odznak Verified a při rozhodování ho zohledňuje (přednost). Event lze volitelně omezit **jen pro Verified** (volba na eventu).
- **Výhody Verified nastavuje pořadatel u každého eventu zvlášť:** zda Verified upřednostní a jaký předstih před ostatními dostanou (hodiny, den, týden, měsíc, nebo žádný).
- **Kritéria selekce určuje pořadatel u každého eventu.** Každé auto/projekt se posuzuje individuálně a kritéria se liší podle typu srazu (tuning: úpravy a kvalita provedení; americké vozy a veterány: samotné auto, originalita, stav). Event proto má **textový popis selekce** (zobrazí se žadatelům před odesláním žádosti) a pořadatel u každé žádosti může přidat **interní poznámku** a zvolit **důvod zamítnutí** ze šablony.
- **Typy eventu podle přístupu:**
  - **veřejný** – může se hlásit kdokoli; pořadatel může Verified upřednostnit (přednost při schvalování a dřívější okno registrace)
  - **jen pro Verified**
  - **soukromý na pozvánky** – kapacitně omezený, vidí ho a hlásí se na něj jen pozvaní (pozvánky rozesílá pořadatel nebo se udělují vybraným Verified)

### 5.1a Profil a garáž – upřesnění (rozhodnuto 10. 11. 2026, Milník 2)
- **Výchozí viditelnost:** nový profil i nové vozidlo jsou **veřejné**; majitel může přepnout na soukromé.
- **Soukromý profil:** cizí uživatel nevidí profil ani žádné vozidlo v něm (ani veřejně nastavené).
- **Mazání vozidla:** smazat lze jen vozidlo, které **nikdy nebylo přihlášené na event** (omylem založené). Jinak jen „Prodáno“ → archiv „Bývalá auta“.
- **Uživatelské jméno:** povinné, jedinečné, 3–30 znaků (malá písmena a–z, číslice, tečka, podtržítko). Je v adrese veřejného profilu `/u/<jmeno>`.
- **Kategorie vozidel:** Tuning, Youngtimer, Americké, Veterán, Klasik, Motorka, Ostatní. Typ: auto / motorka.
- **Výkon:** zadává se v koních (k), kW se dopočítá.
- **Fotky:** max. 20 na vozidlo, zmenšení v prohlížeči do 3 velikostí (WebP). Při nahrání uživatel potvrdí, že SPZ je zakrytá/rozmazaná. Automatické rozpoznání SPZ ve v1 není.
- **Země:** evropské země, nahoře ČR, SK, PL.

### 5.1b Eventy a sezóny – upřesnění (rozhodnuto 11. 11. 2026, Milník 3)
- **Pořadatel** = záznam v `organizers` navázaný na profil, se stavem (čeká / schválený / pozastavený). Spravuje jen své sezóny a eventy. Admin vidí vše.
- **Stavy eventu:** koncept (vidí jen pořadatel) → zveřejněný → uzavřený (vidět, nelze se hlásit); navíc **zrušený** (vidět s jasným označením). Smazat jde jen koncept.
- **Viditelnost:** veřejné a „jen Verified“ eventy vidí po zveřejnění kdokoli; event **na pozvánky** vidí jen pořadatel (od Milníku 6 i pozvaní).
- **Adresa eventu:** `/e/<slug>` z názvu a roku (např. `underground-meeting-3-2027`), lze upravit.
- **Místo:** název, adresa a bod na mapě (kliknutím). Mapa MapLibre + podklad OpenFreeMap (bez klíče). Bez automatického hledání adres.
- **Program, pravidla, popis selekce:** prosté texty s odstavci.
- **Obrázek:** jeden hlavní obrázek, zmenšený do 3 velikostí (jako fotky aut), soukromé úložiště s RLS.
- **Kategorie eventu:** Tuning, Youngtimer, Americké, Veterán, Klasik, Motorky, Mix.
- **Registrace (použije Milník 4):** otevření registrace, předstih pro Verified (žádný / 24 h / 3 dny / 1 týden / 1 měsíc; termín pro Verified se dopočítá), „upřednostnit Verified“, uzávěrka. Limit míst = počet vozidel, prázdné = bez limitu.
- **Čas:** ukládá se v UTC, zadává a zobrazuje v pražském čase (Europe/Prague); jiné zóny později.
- **Duplikace:** kopie eventu včetně obrázku jako koncept. **Hromadné založení:** v sezóně více řádků (název + datum) → koncepty.

### 5.1c Registrace a schvalování – upřesnění (rozhodnuto 12. 11. 2026, Milník 4)
- **Přihláška = jedno vozidlo.** Člen může přihlásit více vozidel (každé zvlášť, každé schválené zabírá místo). Jedno vozidlo má na eventu nejvýš jednu přihlášku (kromě zrušených); po zamítnutí se stejné vozidlo znovu hlásit nemůže.
- **Údaje:** telefon (povinný), e-mail (předvyplněný z účtu), zpráva pořadateli (nepovinná). Vidí je jen uchazeč a pořadatel eventu.
- **Souhlasy:** zpracování údajů pořadatelem pro účely eventu; u soukromého vozidla navíc potvrzení, že údaje uvidí pořadatel.
- **Podmínky:** uživatelské jméno, vozidlo v garáži (ne v archivu), event zveřejněný, registrace otevřená (Verified od `registration_verified_opens_at`, ostatní od `registration_opens_at`), před uzávěrkou a před začátkem eventu; „jen Verified“ jen pro Verified. Eventy na pozvánky: přihlašování až s pozvánkami (Milník 6).
- **Stavy:** čeká → schváleno / zamítnuto (důvod ze šablony: kapacita, kritéria selekce, neúplné údaje, jiný + volitelný text) / čekací listina; uchazeč může zrušit před začátkem eventu. Úprava po odeslání není možná.
- **Kapacita:** počítají se schválené. Při plné kapacitě jde schválení i nová přihláška na čekací listinu. Když se uvolní místo (zrušení, zamítnutí schváleného), **automaticky** se schválí první z listiny – Verified první, pokud má event „upřednostnit Verified“, jinak podle času přihlášení.
- **Interní poznámka** pořadatele je oddělená a uchazeč ji nikdy nevidí.
- **Soukromé vozidlo a profil uchazeče** vidí pořadatel eventu, na který se uchazeč hlásí. Veřejný seznam účastníků zatím není.
- Vozidlo, které bylo kdykoli přihlášené na event, nejde smazat (jen „Prodáno“).

### 5.1d Notifikace a komunikace – upřesnění (rozhodnuto 12. 11. 2026, Milník 5)
- **E-maily přes Resend** z vlastní domény (bez domény jen testování na vlastní adresu). Bezplatný tarif 100 e-mailů/den – fronta hlídá denní limit a zbytek odešle později; pro ostrý provoz počítat s placeným tarifem.
- **Automatické e-maily + upozornění v aplikaci** při každé změně stavu přihlášky: přijata, schváleno, zamítnuto (s důvodem), čekací listina, posun z čekací listiny. Zrušení vlastní přihlášky jen upozornění v aplikaci.
- **Jazyk e-mailů** podle jazyka při registraci, lze změnit v profilu.
- **Hromadné zprávy** jen účastníkům daného eventu, skupiny: schválení / čekající / čekací listina / schválení Verified / všichni aktivní. E-mail + upozornění, náhled, počet příjemců, historie; nejvýš 5 zpráv na event za den. V textu lze použít {jmeno} a {event}.
- **Export:** CSV pro Excel (UTF-8, středníky) a tisková stránka (Uložit jako PDF) se seznamem a políčkem na odškrtnutí jako papírová záloha.
- **Push notifikace** odloženy (Milník 7/8).

### 5.1e Turba, sledování, Síň slávy a Garáž snů – upřesnění (rozhodnuto 11. 11. 2026, Milník 5b)
- **Turbo** = jednoduchý „like“ s ikonou turbodmychadla. Dává se **fotce vozidla** nebo **garáži** (profilu). Jeden uživatel = nejvýš jedno turbo na položku, opakovaným klepnutím se odebere. Žádná peněženka ani limity. Vlastnímu obsahu turbo dát nejde. Jen přihlášení, jen na veřejný obsah.
- **Součty:** vozidlo = turba jeho fotek; garáž = turba garáže + turba fotek jejích (veřejných) vozidel. U položky je vidět, kdo turbo dal (pár jmen + „a další“).
- **Upozornění** se slučují: „@tuner22 a 4 další dali turbo tvému BMW E30“ – jedno upozornění na položku, dokud ho majitel nepřečte. Bez e-mailu.
- **Sledování garáže:** tlačítko Sledovat, počet sledujících, upozornění „X tě začal(a) sledovat“. Vlastní garáž sledovat nejde.
- **Žebříčky:** auta, garáže, nejaktivnější fanoušci (dané turbo); období týden / měsíc / rok / celkem; jen veřejné profily a vozidla.
- **Síň slávy:** zeď odznaků na profilu. Obecný systém: odznak má ikonu, název a popis (cs/en), vzácnost (běžný / vzácný / epický / legendární – barevně), datum a zdroj udělení, případně příznak **unikátní** (jen jeden člověk vůbec).
  - Turbo ocenění za **získaná** turba: bronzové 100, stříbrné 500, zlaté 1000. Unikátní: „První, kdo získal 1000 turb“.
  - Za **daná** turba: Nadšenec 50, Fanoušek scény 250, Legenda komunity 1000.
  - **Série** 🔥 (aspoň jedno turbo denně, pražský čas): 7 / 30 / 100 dní.
  - **Objevitel:** dal turbo mezi prvními 10 autu (fotkám vozidla), které později dosáhlo 100 turb.
  - **Zakládající člen:** prvních 100 registrovaných.
  - Ruční odznaky od admina (např. Garáž roku); později odznaky za účast na eventu (Milník 7) a výzvy (v1.5).
  - Odebrané turbo už udělený odznak nebere.
- **Garáž snů:** druhá sekce profilu. Položka: značka, model, rok nebo rozsah, poznámka, stav (💭 Sním o něm / 🎯 Plánuji koupit / 🔍 Aktivně hledám), viditelnost veřejná/soukromá. Fotka jen vlastní, nebo žádná (elegantní karta bez fotky); obrázky z internetu ne.
  - **„Tohle chci!“** u vozidla jiného člena přidá auto do Garáže snů s odkazem a jeho fotkou; u auta je vidět „Je v garáži snů u N lidí“.
  - „Aktivně hledám“ se později propojí s bazarem (v3).
- **Fanoušek / Majitel:** člen bez vozidla má štítek Fanoušek a používá Garáž snů; s prvním vozidlem se stává Majitelem.

### 5.2 Ticketing
**Ve v1 není.** Registrace je jen žádost o účast. Vstupné se řeší mimo aplikaci (jako dosud).
Důvod: riziko výpadku v den akce. Pozdější ticketing bude zapnutelná funkce, ne závislost.

**Check-in** (QR) ale **v1 je**: slouží k ověření účasti pro odznaky. Musí fungovat **i offline** a nesmí být nutný pro vpuštění na akci (záložní postup: tištěný seznam).

### 5.3 Odznaky
Odznak za účast na eventu se uděluje **jen po check-inu** (ověřená účast), ne za pouhou registraci.

## 6. Datový model (hrubý návrh)

Obecné objekty: `entry` = to, co se hlásí na event (auto, model, motorka). Ve v1 podporujeme **auto** a **motorku**; model expo zatím jako samostatná kategorie registrace, ne plnohodnotný profil (rozhodnout později).

- `profiles` – id, uživatelské jméno, jméno, země, město, bio, avatar, role, viditelnost (public/private), verified_at
- `vehicles` – id, owner_id, typ (auto/moto), kategorie (tuning/youngtimer/americké/veterán/…), značka, model, rok, motor, výkon, popis, příběh projektu, země, viditelnost (public/private), stav (current/former), pořízeno_kdy, prodáno_kdy
- `vehicle_photos` – vehicle_id, url, pořadí
- `vehicle_mods` – vehicle_id, kategorie, popis (seznam úprav)
- `verifications` – user_id, vehicle_id (nepovinné), kód, cesta k videu (soukromé úložiště), stav (pending/approved/rejected/expired), důvod, kým, kdy, smazání videa
- `organizers` – profile_id, název, popis, logo, stav schválení
- `seasons` – id, organizer_id, název, rok
- `events` – id, organizer_id, season_id, název, popis, začátek, konec, místo, souřadnice, země, kategorie, limit míst, popis_selekce, uzávěrka registrace, přístup (public/verified_only/invite_only), verified_prednost (ano/ne), registrace_verified_od, registrace_ostatni_od, stav (draft/published/closed)
- `event_invites` – event_id, user_id, pozval (kým), stav (sent/accepted/declined/expired)
- `event_registrations` – event_id, vehicle_id, user_id, kategorie, stav (pending/approved/rejected/waitlist/cancelled), poznámka pořadatele
- `checkins` – registration_id, čas, kým, zdroj (online/offline sync)
- `badges` – id, název, popis, ikona, typ (event/spot/challenge/milestone)
- `user_badges` – user_id, badge_id, kdy, odkud
- `spots` – id, název, popis, souřadnice, země, poloměr ověření, stav
- `challenges` – id, název, popis, úroveň (country/europe), země, spot_id (nepovinné), začátek, konec, cena, stav
- `challenge_entries` – challenge_id, user_id, vehicle_id, foto, stav moderace, GPS ověření
- `votes` – entry_id, user_id (jeden hlas na entry)
- `notifications` – user_id, typ, obsah, přečteno
- `message_broadcasts` – event_id, segment, předmět, obsah, kanál (e-mail/push)
- `reports` – cíl, důvod, stav moderace

Pozn.: schéma se bude zpřesňovat při stavění; všechny tabulky mají od začátku zapnuté **Row Level Security** (Supabase).

## 7. Uživatelské toky (v1)

1. **Registrace a profil:** e-mail + heslo nebo Google/Apple → vyplnění profilu (jméno, země, avatar).
2. **Garáž:** přidání auta (údaje, fotky, úpravy), okamžitě viditelné ve vlastní garáži.
2b. **Verified (volitelné):** aplikace zobrazí náhodnou větu → uživatel natočí video u auta → admin schválí/zamítne → notifikace a odznak na profilu.
2c. **Správa garáže:** změna viditelnosti vozidla, označení „prodáno“ → přesun do archivu, přidání nového vozidla.
3. **Objevování eventů:** seznam a detail eventu (program, místo, pravidla, uzávěrka).
4. **Registrace na event:** výběr auta z garáže → odeslání žádosti → stav „čeká na schválení“.
5. **Pořadatel – schvalování:** přehled žádostí s fotkami, údaji a odznakem Verified → schválit / zamítnout / čekací listina → automatická notifikace uživateli.
6. **Pořadatel – komunikace:** hromadná zpráva všem schváleným (e-mail + push), šablony textů.
7. **Pořadatel – export:** seznam účastníků (CSV/PDF) pro tisk a organizaci.
8. **Check-in:** pořadatel (telefon) skenuje QR kód účastníka → zápis účasti (offline fronta) → odznak.
9. **Odznaky:** zobrazení na profilu a v garáži auta.

## 8. Rozsah verzí

### v1 – Jádro (cíl: **hotové a odzkoušené do konce března 2027**, aby přes ELITEZ mohly běžet registrace na Underground meeting 3 (květen) a Tuning show Trojhalí (červen))
- Účty, profil, garáž (otevřená všem, viditelnost veřejná/soukromá, archiv bývalých vozidel)
- Žádost o Verified (video s větou, ruční schválení adminem), odznak a základní výhoda: viditelnost při selekci pořadatele
- Eventy a **sezóny** (zakládáš jen ty, včetně hromadného založení a duplikace eventu); první dva: Underground meeting 3 a Tuning show Trojhalí
- Registrace na eventy a schvalování pořadatelem
- E-mailové notifikace, základní push
- Hromadná komunikace s účastníky
- Export seznamů
- QR check-in (včetně offline) a odznaky za účast
- Čeština + angličtina
- Světlý design, PWA použitelná na mobilu

### v1.5 – Hra (leden–květen 2027, podle stavu v1)
- SPOTy a měsíční challenge, soutěž po zemích
- Hlasování a porota, moderace
- První challenge navázaná na větší event

### v2
- Přátelé a viditelnost „jen pro přátele“ (odloženo)
- Onboarding dalších promotérů (žádost → schválení adminem → vlastní správa eventů)
- Slovenština, polština
- Pořadatelské statistiky, segmentace, sponzorské prvky
- Komunita (sledování, komentáře), mapa srazů
- Případně ticketing jako volitelný modul

### v3
- Bazar (inzeráty navázané na profil auta), ověřování prodejců, placené zvýraznění
- Reklama

### Co **není** ve v1
Bazar, ticketing, platby, sociální feed, chat, nativní aplikace v obchodech.

### Orientační harmonogram (návrh)

| Období | Cíl |
|---|---|
| Listopad–prosinec 2026 | Doladit SPEC, prototyp vzhledu, založit účty a projekt, základ (přihlášení, profil) |
| Leden–únor 2027 | Garáž, eventy a sezóny, registrace, schvalování pořadatelem |
| Březen 2027 | Notifikace, export, QR check-in, odznaky, Verified, testování s malou skupinou |
| Duben 2027 | Oprava chyb, zátěžový test, právní texty, příprava registrací |
| **15. 5. 2027** | **Underground meeting 3** (varianta A: ostrý provoz, varianta B: malý pilot nebo jen check-in) |
| Květen–červen 2027 | Úpravy podle zkušeností z Undergroundu |
| **19.–20. 6. 2027** | **Tuning show Trojhalí** |

Projekt se nevazuje na pevný termín: stavíme **co nejdřív a po funkčních celcích** (viz TASKS.md). Rozhodnutí o variantě A/B pro Underground meeting 3 se dělá nejpozději na konci ledna 2027 podle skutečného pokroku.

## 9. SPOTy a challenge – návrh pravidel (k doladění)

- **SPOT** = konkrétní místo (industriální areál, vyhlídka, ikonické místo) s GPS souřadnicemi a poloměrem.
- **Ověření polohy:** foto musí být pořízeno **přímo v aplikaci** s kontrolou GPS v poloměru spotu. Nahrání hotové fotky z galerie GPS ověření nemá a EXIF se dá snadno zfalšovat, proto jen jako „nevalidovaná“ fotka.
- **Úrovně soutěže:** země (ČR, SK, PL…) a Evropa. Spot v ČR počítá do soutěže ČR; Evropa může mít vlastní téma bez vazby na místo (např. Messe Essen).
- **Vyhodnocení:** kombinace hlasů komunity a poroty (jinak vítězí největší účty a hrozí manipulace hlasů).
- **Ochrana:** jeden hlas na uživatele, limity na nové účty, nahlášení, moderace.
- **Soukromí:** zákaz zveřejnění SPZ (rozmazání/odmítnutí), souhlas s použitím fotek pro propagaci.
- **Ceny:** řeší provozovatel (sponzoři); pravidla soutěže musí být právně ošetřena (viz 12).

## 10. Technologie

- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS, nasazeno jako **PWA** (instalace na plochu, push notifikace)
- **Backend a databáze:** Supabase (PostgreSQL, Auth, Storage, Row Level Security)
- **E-maily:** Resend (nebo Postmark)
- **Push:** Web Push (PWA), případně OneSignal
- **Hosting:** Vercel (frontend) + Supabase (backend)
- **Obrázky:** Supabase Storage s CDN, automatické zmenšení
- **Mapy:** MapLibre / OpenStreetMap (levnější než Google Maps)
- **Kód:** GitHub, automatické testy, hlavní větev chráněná
- **Později:** nativní aplikace (např. přes Capacitor), Stripe, vyhledávání (Meilisearch)

Proč PWA místo nativní aplikace: jedna kódová základna, rychlý vývoj, žádné schvalování v App Storu při každé změně. Omezení: push na iOS vyžaduje instalaci na plochu.

## 11. Design

> Aktualizováno 11. 11. 2026: rozhodnuto o **kombinaci tmavé a světlé** (inspirace: skysthelimit.org, gamingonavax.com, veyda.com).

- **Styl:** prémiový, filmový, obsah (fotky aut) před formou. Kombinace:
  - **tmavé „výkladní“ části** – úvodní stránka, eventy, profily členů, stránky vozidel, galerie: černý základ, jemná žlutá záře, velké fotky přes celou šířku;
  - **světlé „pracovní“ části** – formuláře, správa garáže, administrace, přihlášky: bílé/světle šedé pozadí kvůli čitelnosti na mobilu venku.
- **Barvy:** černá + žlutá. Žlutá je akcent (tlačítka, odznaky, zvýraznění klíčového slova, záře). Na tmavém pozadí smí být žlutý text; na bílém **nikdy** (kontrast).
- **Typografie:** výrazné úzké tučné písmo pro nadpisy (styl motorsportu, verzálky) + čisté bezpatkové písmo (Inter) na texty. Malé nadpisky VERZÁLKAMI se žlutou tečkou.
- **Prvky:** tmavá skleněná hlavička (rozmazané pozadí), karty s jemnou září při najetí, fotky se ztmavením a nadpisem přes ně, číslované seznamy s tenkými linkami, jemné animace.
- **Přístupnost:** dostatečný kontrast v obou režimech; animace respektují nastavení „omezit pohyb“.
- Logo a vizuální identita: zatím provizorní textové logo, vymění se po dodání loga.

## 12. Právní a provozní věci

- **Provozovatel:** firma vlastníka projektu = správce osobních údajů (GDPR). Obchodní podmínky a zásady zpracování se píší na ni. Role provozovatele klubu a promotéra eventů je třeba v podmínkách oddělit, až se připojí další promotéři.

- **GDPR:** souhlasy, zásady zpracování, mazání účtu a dat, fotky osob a SPZ
- **Video pro Verified:** osobní údaje (obličej, hlas). Jasný souhlas, účel, krátká doba uložení, soukromé úložiště, smazání po ověření.
- **Pravidla soutěží:** právně ošetřená pravidla (zvlášť u cen a po zemích)
- **Obchodní podmínky a pravidla komunity:** ELITEZ jako zprostředkovatel, odpovědnost za akce nese pořadatel
- **Věk:** minimální věk uživatele **16+** (GDPR, souhlas se zpracováním osobních údajů)
- **Ověření značky ELITEZ:** doména, sociální sítě, ochranná známka (EUIPO)
- **Zálohy databáze** a plán obnovy
- Bazar později: DSA (EU) pro tržiště

## 13. Rozpočet (orientační)

- Start (vývoj a testování): **0–500 Kč/měsíc** (bezplatné tarify Supabase, Vercel, Resend)
- Provoz po spuštění: **cca 1 000–2 500 Kč/měsíc** (Supabase Pro, doména, e-maily, push), roste s počtem uživatelů a fotek
- Největší náklad v čase: **úložiště a přenos fotek** – proto zmenšování obrázků od začátku

## 14. Rizika

1. **Rozsah** – sociální síť + hra + bazar najednou je moc. Držet se verzí.
2. **Cold start** – komunita musí mít důvod chodit i mimo eventy → odznaky a garáž od začátku.
3. **Spolehlivost v den akce** – check-in offline a záložní papírový postup.
4. **Moderace obsahu a podvody** v soutěžích.
5. **Ruční ověřování Verified** zabere čas adminů – při růstu nutné frontu zrychlit (omezit na nutné případy, později spolupracovníci/automatizace).
6. **Závislost na jednom člověku** (tobě) – dokumentace v repozitáři, SPEC a CLAUDE.md průběžně aktualizovat.

## 15. Otevřené otázky

1. **Underground meeting 3 (15. 5. 2027):** varianta A, B, nebo pilot? Rozhodnutí nejpozději konec ledna 2027.
2. Kdy se má otevřít registrace na Underground meeting 3?
3. Ověření názvu ELITEZ (domény, sociální sítě, ochranná známka EUIPO).
4. Kritéria Verified: sepsat veřejné shrnutí (jednoduché, bez příkladů ze zamítnutí) a šablonu zdvořilé odpovědi.
