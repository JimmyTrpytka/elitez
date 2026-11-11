"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
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
  const firstAvailable = vehicles.find((v) => !v.alreadyRegistered)?.id ?? "";
  const [vehicleId, setVehicleId] = useState(firstAvailable);
  const selected = vehicles.find((v) => v.id === vehicleId);
  const needsPrivateAck = profilePrivate || selected?.visibility === "private";

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="event_id" value={eventId} />
      {state.status === "error" ? <Alert tone="error">{tErrors(state.error)}</Alert> : null}

      <fieldset className="flex flex-col gap-2">
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
      </fieldset>

      {needsPrivateAck ? (
        <Alert tone="info">{t("privateNotice")}</Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("phoneLabel")}
          name="phone"
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
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
          <span>{t("consentLabel")}</span>
        </label>
        {needsPrivateAck ? (
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="private_ack"
              required
              className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
            />
            <span>{t("privateAckLabel")}</span>
          </label>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={pending || !vehicleId} className="w-full sm:w-auto">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
