import { createClient } from "@/lib/supabase/server";
import { buildIcs } from "@/lib/calendar";

/** Veřejná adresa webu pro odkaz v kalendáři. */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.elitezclub.eu").replace(/\/+$/, "");
}

/**
 * Soubor .ics s eventem. Čte se s přihlášením volajícího → RLS pustí jen
 * eventy, které smí vidět (koncepty a cizí pozvánkové eventy ne).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/events/[slug]/calendar">) {
  const { slug } = await ctx.params;
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "cs";
  const supabase = await createClient();
  if (!supabase) return new Response("Not found", { status: 404 });
  const { data: event } = await supabase
    .from("events")
    .select("id, slug, title, description, starts_at, ends_at, venue_name, venue_address")
    .eq("slug", slug)
    .maybeSingle();
  if (!event) return new Response("Not found", { status: 404 });

  const ics = buildIcs({
    uid: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    location: [event.venue_name, event.venue_address].filter(Boolean).join(", ") || null,
    description: event.description,
    url: `${siteUrl()}/${locale}/e/${event.slug}`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
