import { NextResponse, type NextRequest } from "next/server";
import { processEmailOutbox } from "@/lib/email/outbox";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Jednou denně (Vercel cron): rozešle výzvy k potvrzení účasti (eventy,
 * kterým se otevřelo okno potvrzení) a odešle, co zůstalo ve frontě e-mailů
 * (např. e-maily nad denní limit z předchozího dne).
 * Chráněno tajným CRON_SECRET (Vercel ho posílá v hlavičce Authorization).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: attendanceRequests } = admin
    ? await admin.rpc("send_attendance_requests")
    : { data: null };
  const result = await processEmailOutbox();
  return NextResponse.json({ attendanceRequests: attendanceRequests ?? 0, ...result });
}
