import { NextResponse, type NextRequest } from "next/server";
import { processEmailOutbox } from "@/lib/email/outbox";

/**
 * Pojistka: Vercel jednou denně odešle, co zůstalo ve frontě
 * (např. e-maily nad denní limit z předchozího dne).
 * Chráněno tajným CRON_SECRET (Vercel ho posílá v hlavičce Authorization).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processEmailOutbox();
  return NextResponse.json(result);
}
