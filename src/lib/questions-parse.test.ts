import { describe, expect, it } from "vitest";
import { parseQuestionsJson } from "./questions-parse";

describe("vlastní otázky eventu", () => {
  it("vynechá prázdné a vyčistí možnosti výběru", () => {
    const r = parseQuestionsJson(
      JSON.stringify([
        { kind: "text", label: "  ", options: "", required: false },
        { kind: "choice", label: "Tričko", options: "S\nM, L\nM", required: true },
        { kind: "number", label: "Počet osob", options: "x", required: false },
      ]),
    );
    expect(r).toEqual({
      ok: true,
      items: [
        { id: null, kind: "choice", label: "Tričko", options: ["S", "M", "L"], required: true },
        { id: null, kind: "number", label: "Počet osob", options: null, required: false },
      ],
    });
  });

  it("výběr potřebuje aspoň dvě možnosti", () => {
    expect(parseQuestionsJson(JSON.stringify([{ kind: "choice", label: "X", options: "A" }]))).toEqual({ ok: false });
  });

  it("odmítne neplatný typ a nesmysl", () => {
    expect(parseQuestionsJson(JSON.stringify([{ kind: "file", label: "X" }]))).toEqual({ ok: false });
    expect(parseQuestionsJson("{nesmysl")).toEqual({ ok: false });
    expect(parseQuestionsJson("")).toEqual({ ok: true, items: [] });
  });
});
