import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmail, type EmailPayload, type EmailTemplate } from "./render";

/**
 * Odeslání fronty e-mailů přes Resend.
 * - volá se po akcích (přihláška, rozhodnutí, hromadná zpráva) a 1× denně cronem,
 * - hlídá denní limit (EMAIL_DAILY_LIMIT, výchozí 100 = bezplatný Resend),
 * - posílá po dávkách (Resend batch API, max. 100 e-mailů na volání),
 * - chyby se zkusí znovu později (databázová funkce fail_email).
 * Bez RESEND_API_KEY nebo SUPABASE_SECRET_KEY nedělá nic (e-maily zůstanou ve frontě).
 */

const BATCH_SIZE = 50;
const MAX_BATCHES_PER_RUN = 4;

export type OutboxResult = { sent: number; failed: number; skipped?: string };

export async function processEmailOutbox(): Promise<OutboxResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const admin = createAdminClient();
  if (!apiKey || !from) return { sent: 0, failed: 0, skipped: "resend_not_configured" };
  if (!admin) return { sent: 0, failed: 0, skipped: "secret_key_missing" };

  const dailyLimit = Number(process.env.EMAIL_DAILY_LIMIT ?? 100) || 100;
  const replyTo = process.env.EMAIL_REPLY_TO;
  let sent = 0;
  let failed = 0;

  for (let round = 0; round < MAX_BATCHES_PER_RUN; round++) {
    const { data: batch, error } = await admin.rpc("claim_email_batch", {
      p_limit: BATCH_SIZE,
      p_daily_limit: dailyLimit,
    });
    if (error || !batch || batch.length === 0) break;

    const emails = batch.map((row) => {
      const rendered = renderEmail(
        row.template as EmailTemplate,
        row.locale,
        (row.payload ?? {}) as EmailPayload,
      );
      return {
        from,
        to: [row.to_email],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      };
    });

    try {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": batch.map((r) => r.id).join(",").slice(0, 256),
        },
        body: JSON.stringify(emails),
      });
      const result = (await response.json().catch(() => null)) as {
        data?: Array<{ id: string }>;
        message?: string;
      } | null;

      if (!response.ok || !result?.data) {
        const message = result?.message ?? `HTTP ${response.status}`;
        await Promise.all(batch.map((row) => admin.rpc("fail_email", { p_id: row.id, p_error: message })));
        failed += batch.length;
        // Limit poskytovatele (429) → zkusit až příště
        if (response.status === 429) break;
        continue;
      }

      await Promise.all(
        batch.map((row, i) =>
          admin.rpc("complete_email", { p_id: row.id, p_provider_id: result.data?.[i]?.id ?? "" }),
        ),
      );
      sent += batch.length;
    } catch (e) {
      const message = e instanceof Error ? e.message : "network_error";
      await Promise.all(batch.map((row) => admin.rpc("fail_email", { p_id: row.id, p_error: message })));
      failed += batch.length;
      break;
    }

    if (batch.length < BATCH_SIZE) break;
  }

  return { sent, failed };
}
