import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("CSV pro Excel", () => {
  it("má BOM, středníky a CRLF", () => {
    const csv = toCsv([
      ["Jméno", "Auto"],
      ["Žaneta", "Škoda 130 RS"],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Jméno;Auto\r\nŽaneta;Škoda 130 RS\r\n");
  });
  it("uvozovky a středníky v hodnotě", () => {
    expect(toCsv([['Řekl "ahoj"; pak']])).toBe('﻿"Řekl ""ahoj""; pak"\r\n');
  });
  it("neutralizuje vzorce", () => {
    expect(toCsv([["=SUM(A1)", "+cmd|x", "+420777"]])).toBe("\uFEFF'=SUM(A1);'+cmd|x;+420777\r\n");
  });
});
