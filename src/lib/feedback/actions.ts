"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processEmailOutbox } from "@/lib/email/outbox";
import { revalidatePath } from "next/cache";

export type FeedbackFormState =
  | { status: "idle" }
  | { status: "error"; error: "invalid_message" | "invalid_email" | "rate_limited" | "generic" }
  | { status: "success" };

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Odeslání připomínky testera (i bez přihlášení). */
export async function submitFeedback(
  _prev: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const message = text(formData, "message").trim();
  const email = text(formData, "email").trim();
  const from = text(formData, "from").trim();
  if (message.length < 3 || message.length > 4000) {
    return { status: "error", error: "invalid_message" };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", error: "invalid_email" };
  }
  const page = from.startsWith("/") && !from.startsWith("//") ? from.slice(0, 300) : "";

  const supabase = await createClient();
  if (!supabase) return { status: "error", error: "generic" };
  const userAgent = (await headers()).get("user-agent") ?? "";
  const { error } = await supabase.rpc("submit_feedback", {
    p_message: message,
    p_page_path: page,
    p_contact_email: email,
    p_user_agent: userAgent.slice(0, 400),
  });
  if (error) {
    return {
      status: "error",
      error: error.message === "rate_limited" ? "rate_limited" : error.message === "invalid_message" ? "invalid_message" : "generic",
    };
  }
  after(async () => {
    await processEmailOutbox();
  });
  return { status: "success" };
}

/** Admin: označit připomínku jako vyřešenou / znovu otevřít. */
export async function setFeedbackResolved(id: string, resolved: boolean): Promise<{ ok: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  const supabase = await createClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc("resolve_feedback", { p_id: id, p_resolved: resolved });
  if (!error) revalidatePath("/", "layout");
  return { ok: !error };
}
