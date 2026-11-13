/**
 * Kontrola dotazů proti skutečné databázi (npm run test:api).
 *
 * Projde zdrojový kód, najde každé `.from("tabulka") … .select("…")`, které
 * načítá propojené tabulky (závorky v select), a spustí ho jako návštěvník.
 * Odhalí např. nejednoznačné propojení (PGRST201 – tak zmizely eventy z webu),
 * chybějící propojení (PGRST200) nebo neexistující sloupec (42703).
 * Nic nezapisuje – jen čte (limit 1). Chyby oprávnění (42501) jsou v pořádku:
 * návštěvník některé tabulky číst nesmí, ale dotaz jako takový je platný.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith("database.types.ts") ? [path] : [];
  });
}

type Query = { file: string; table: string; select: string };

/** Najde dotazy s propojením tabulek; konstanty (`const X = "…"`) dosadí. */
export function findQueries(): Query[] {
  const out: Query[] = [];
  for (const path of files(SRC)) {
    const code = readFileSync(path, "utf8");
    const consts = new Map<string, string>();
    for (const m of code.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*(["`])([^"`]*)\2/g)) consts.set(m[1], m[3]);
    const resolve = (s: string) => s.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name: string) => consts.get(name) ?? "*");
    const re = /\.from\(\s*"(\w+)"\s*\)\s*\.select\(\s*(?:(["`])([\s\S]*?)\2|([A-Z_][A-Z0-9_]*))/g;
    for (const m of code.matchAll(re)) {
      const raw = m[3] ?? (m[4] ? consts.get(m[4]) : undefined);
      if (!raw) continue;
      const select = resolve(raw).replace(/\s+/g, " ").trim();
      if (!select.includes("(")) continue;
      out.push({ file: relative(ROOT, path), table: m[1], select });
    }
  }
  return out;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe("dotazy s propojením tabulek", () => {
  const queries = findQueries();

  it(`najde dotazy ve zdrojovém kódu (${queries.length})`, () => {
    // pojistka: kdyby se hledání rozbilo, test by jinak tiše nic nekontroloval
    expect(queries.length).toBeGreaterThan(10);
  });

  it.skipIf(!url || !key)("všechny projdou proti databázi", async () => {
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const failures: string[] = [];
    for (const q of queries) {
      const { error } = await supabase.from(q.table).select(q.select).limit(1);
      if (error && error.code !== "42501") {
        failures.push(`${q.file}: from("${q.table}").select("${q.select}")\n   → ${error.code}: ${error.message}`);
      }
    }
    expect(failures, failures.join("\n\n")).toEqual([]);
  }, 60_000);
});
