import { createClient } from "@/lib/supabase/server";
import { PROMO_CONSENT_VERSION } from "@/lib/consent";
import { PromoConsentModal } from "./promo-consent-modal";

/**
 * Přihlášený člen, který ještě nedal (aktuální) povinný souhlas s propagací,
 * dostane jednorázové okno. Bez souhlasu web dál používat nejde.
 */
export async function PromoConsentGate() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("promo_consent_version")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!data || data.promo_consent_version === PROMO_CONSENT_VERSION) return null;
  return <PromoConsentModal />;
}
