/**
 * CSV pro Excel: UTF-8 s BOM (aby Excel správně ukázal češtinu),
 * oddělovač středník (české nastavení Excelu), řádky CRLF.
 */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const escape = (value: string | number | null | undefined) => {
    const s = value === null || value === undefined ? "" : String(value);
    // Ochrana proti „vzorcům“ v Excelu: =, @ nebo +/- následované ne-číslicí
    // (telefon „+420…“ zůstane beze změny)
    const safe = /^(?:[=@\t\r]|[+\-][^\d\s])/.test(s) ? `'${s}` : s;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "\uFEFF" + rows.map((r) => r.map(escape).join(";")).join("\r\n") + "\r\n";
}
