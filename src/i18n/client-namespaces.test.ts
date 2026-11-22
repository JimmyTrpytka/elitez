import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import cs from "@/i18n/messages/cs.json";
import { CLIENT_NAMESPACES } from "./client-namespaces";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

describe("překlady posílané do prohlížeče", () => {
  it("obsahují každou část použitou přes useTranslations", () => {
    const used = new Set<string>();
    for (const file of files(join(__dirname, ".."))) {
      for (const m of readFileSync(file, "utf8").matchAll(/useTranslations\(\s*"([A-Za-z]+)"/g)) used.add(m[1]);
    }
    const missing = [...used].filter((ns) => !(CLIENT_NAMESPACES as readonly string[]).includes(ns));
    expect(missing).toEqual([]);
  });

  it("useTranslations se vždy volá s názvem části", () => {
    const bare = files(join(__dirname, "..")).filter((f) => /useTranslations\(\s*\)/.test(readFileSync(f, "utf8")));
    expect(bare).toEqual([]);
  });

  it("všechny uvedené části v překladech existují", () => {
    expect(CLIENT_NAMESPACES.filter((ns) => !(ns in cs))).toEqual([]);
  });
});
