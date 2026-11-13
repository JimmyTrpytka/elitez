"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PROMO_CONSENT_VERSION } from "@/lib/consent";

/** Stávající člen potvrdí povinný souhlas s propagací. */
export async function acceptPromoConsent(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc("accept_promo_consent", { p_version: PROMO_CONSENT_VERSION });
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}
