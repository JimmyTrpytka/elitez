import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/dates";
import { getMyEvent, getMyOrganizer } from "@/lib/data/events";
import { createClient } from "@/lib/supabase/server";

/**
 * Export přihlášek eventu do CSV (Excel). Jen pro pořadatele eventu –
 * kontrola na serveru i v databázi (RLS vrátí jen přihlášky na jeho eventy).
 * ?status=approved (výchozí) | all   ?lang=cs | en
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/organizer/events/[id]/export">) {
  const { id } = await params;
  const langParam = request.nextUrl.searchParams.get("lang") ?? "";
  const locale = hasLocale(routing.locales, langParam) ? langParam : routing.defaultLocale;
  const onlyApproved = request.nextUrl.searchParams.get("status") !== "all";

  const organizer = await getMyOrganizer();
  if (!organizer) return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  const event = await getMyEvent(organizer.id, id);
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  let query = supabase
    .from("event_registrations")
    .select(
      "status, contact_phone, contact_email, message, created_at, rejection_reason, vehicle:vehicles(make, model, year, category), applicant:profiles!event_registrations_user_id_fkey(username, display_name, verified_at), note:event_registration_notes(note)",
    )
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });
  if (onlyApproved) query = query.eq("status", "approved");
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });

  const [t, tStatus, tVehicle, tReason] = await Promise.all([
    getTranslations({ locale, namespace: "Export" }),
    getTranslations({ locale, namespace: "RegistrationStatus" }),
    getTranslations({ locale, namespace: "Vehicle" }),
    getTranslations({ locale, namespace: "RejectionReason" }),
  ]);

  const rows: Array<Array<string | number | null>> = [
    [
      t("colStatus"),
      t("colName"),
      t("colUsername"),
      t("colVerified"),
      t("colVehicle"),
      t("colYear"),
      t("colCategory"),
      t("colPhone"),
      t("colEmail"),
      t("colMessage"),
      t("colSubmitted"),
      t("colReason"),
      t("colNote"),
    ],
    ...(data ?? []).map((r) => {
      const note = Array.isArray(r.note) ? r.note[0] : r.note;
      return [
        tStatus(r.status),
        r.applicant?.display_name ?? "",
        r.applicant?.username ? `@${r.applicant.username}` : "",
        r.applicant?.verified_at ? t("yes") : t("no"),
        r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : "",
        r.vehicle?.year ?? "",
        r.vehicle ? tVehicle(`categories.${r.vehicle.category}`) : "",
        r.contact_phone,
        r.contact_email,
        r.message ?? "",
        formatDateTime(r.created_at, locale, event.timezone),
        r.rejection_reason ? tReason(r.rejection_reason) : "",
        note?.note ?? "",
      ];
    }),
  ];

  const filename = `${event.slug}-${onlyApproved ? "schvaleni" : "vse"}.csv`;
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
