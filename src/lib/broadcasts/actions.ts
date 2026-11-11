"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Constants, type Enums } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { processEmailOutbox } from "@/lib/email/outbox";

const UUID = /^[0-9a-f-]{36}$/i;

export type BroadcastErrorKey =
  | "not_allowed"
  | "invalid_message"
  | "daily_limit"
  | "no_recipients"
  | "generic";

export type BroadcastFormState =
  | { status: "idle" }
  | { status: "error"; error: BroadcastErrorKey }
  | { status: "success"; count: number };

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Odeslání hromadné zprávy (oprávnění, limit a příjemce řeší databáze). */
export async function sendBroadcast(
  _prev: BroadcastFormState,
  formData: FormData,
): Promise<BroadcastFormState> {
  const eventId = text(formData, "event_id");
  const segmentValue = text(formData, "segment");
  const subject = text(formData, "subject").trim();
  const body = text(formData, "body").trim();
  if (!UUID.test(eventId)) return { status: "error", error: "not_allowed" };
  if (!(Constants.public.Enums.broadcast_segment as readonly string[]).includes(segmentValue))
    return { status: "error", error: "no_recipients" };
  if (!subject || subject.length > 150 || !body || body.length > 5000)
    return { status: "error", error: "invalid_message" };

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "generic" };
  const { data, error } = await supabase.rpc("send_broadcast", {
    p_event_id: eventId,
    p_segment: segmentValue as Enums<"broadcast_segment">,
    p_subject: subject,
    p_body: body,
  });
  if (error || !data) {
    const known: BroadcastErrorKey[] = ["not_allowed", "invalid_message", "daily_limit", "no_recipients"];
    const key = known.find((k) => k === error?.message) ?? "generic";
    return { status: "error", error: key };
  }

  revalidatePath("/", "layout");
  after(async () => {
    await processEmailOutbox();
  });
  return { status: "success", count: data.recipient_count };
}
