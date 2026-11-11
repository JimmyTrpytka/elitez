"use client";

import { useKeepValuesSubmit } from "@/components/ui/use-keep-values-submit";
import { useActionState, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { FieldMessage } from "@/components/ui/field-message";
import { useScrollToError } from "@/components/ui/use-scroll-to-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea";
import { submitRegistration, type RegistrationFormState } from "@/lib/registrations/actions";
import { cn } from "@/lib/cn";

type VehicleOption = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  visibility: "public" | "private";
  alreadyRegistered: boolean;
};

const initial: RegistrationFormState = { status: "idle" };

export function RegistrationForm({
  eventId,
  vehicles,
  email,
  profilePrivate,
  selectionCriteria,
}: {
  eventId: string;
  vehicles: VehicleOption[];
  email: string;
  profilePrivate: boolean;
  selectionCriteria: string | null;
}) {
  const t = useTranslations("Registration");
  const tErrors = useTranslations("RegistrationErrors");
  const locale = useLocale();
  const [state, action, pending] = useActionState(submitRegistration, initial);
  const submit = useKeepValuesSubmit(action);
  const formRef = useRef<HTMLFormElement>(null);
  // Chyby u konkrétních míst formuláře (ostatní v rámečku nahoře)
  const fieldOf: Record<string, string> = {
    contact_invalid: "phone",
    consent_required: "consent",
    private_ack_required: "private_ack",
    vehicle_invalid: "vehicle_id",
    already_registered: "vehicle_id",
  };
  const errField = state.status === "error" ? fieldOf[state.error] : undefined;
  const errMessage = state.status === "error" ? tErrors(state.error) : undefined;
  const errorFor = (name: string) => (errField === name ? errMessage : undefined);
  useScrollToError(state, errField, formRef);
  const firstAvailable = vehicles.find((v) => !v.alreadyRegistered)?.id ?? "";
  const [vehicleId, setVehicleId] = useState(firstAvailable);
  const selected = vehicles.find((v) => v.id === vehicleId);
  const needsPrivateAck = profilePrivate || selected?.visibility === "private";

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="event_id" value={eventId} />
      {state.status === "error" && !errField ? (
        <Alert tone="error">{tErrors(state.error)}</Alert>
      ) : null}

      <fieldset className="flex flex-col gap-2" data-field="vehicle_id">
        <legend className="mb-2 text-sm font-medium text-ink">{t("vehicleLabel")}</legend>
        {vehicles.map((v) => (
          <label
            key={v.id}
            className={cn(
              "flex items-center gap-3 rounded-control border border-line p-4 transition-colors",
              v.alreadyRegistered
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-muted",
            )}
          >
            <input
              type="radio"
              name="vehicle_id"
              value={v.id}
              disabled={v.alreadyRegistered}
              checked={vehicleId === v.id}
              onChange={() => setVehicleId(v.id)}
              className="h-5 w-5 shrink-0 accent-ink"
            />
            <span className="flex-1">
              <span className="block font-semibold text-ink">
                {v.make} {v.model}
                {v.year ? ` (${v.year})` : ""}
              </span>
              <span className="text-sm text-subtle">
                {v.alreadyRegistered
                  ? t("alreadyRegistered")
                  : v.visibility === "private"
                    ? t("privateVehicle")
                    : t("publicVehicle")}
              </span>
            </span>
          </label>
        ))}
        <FieldMessage id="vehicle-message" error={errorFor("vehicle_id")} />
      </fieldset>

      {needsPrivateAck ? (
        <Alert tone="info">{t("privateNotice")}</Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("phoneLabel")}
          name="phone"
          error={errorFor("phone")}
          type="tel"
          autoComplete="tel"
          required
          minLength={5}
          maxLength={30}
          placeholder="+420 777 123 456"
        />
        <Field
          label={t("emailLabel")}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={email}
        />
      </div>
      <TextareaField
        label={t("messageLabel")}
        name="message"
        rows={3}
        maxLength={1000}
        hint={t("messageHint")}
      />

      {selectionCriteria ? (
        <div className="rounded-control bg-muted p-4">
          <p className="mb-1 text-sm font-semibold text-ink">{t("selectionTitle")}</p>
          <p className="text-sm whitespace-pre-line text-ink-soft">{selectionCriteria}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <div data-field="consent" className="flex flex-col gap-1.5">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="consent"
            required
            aria-invalid={errorFor("consent") ? true : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
          />
          <span>{t("consentLabel")}</span>
        </label>
          <FieldMessage id="consent-message" error={errorFor("consent")} />
        </div>
        {needsPrivateAck ? (
          <div data-field="private_ack" className="flex flex-col gap-1.5">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="private_ack"
              aria-invalid={errorFor("private_ack") ? true : undefined}
              required
              className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
            />
            <span>{t("privateAckLabel")}</span>
          </label>
            <FieldMessage id="private-ack-message" error={errorFor("private_ack")} />
          </div>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={pending || !vehicleId} className="w-full sm:w-auto">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
