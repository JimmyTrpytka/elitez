/** Doplnění {jmeno}/{name} a {event} do textu hromadné zprávy (sdíleno serverem i prohlížečem). */
export function fillPlaceholders(text: string, name: string, eventTitle: string): string {
  return text.replace(/\{(jmeno|jméno|name)\}/gi, name).replace(/\{event\}/gi, eventTitle);
}
