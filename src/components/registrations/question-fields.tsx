"use client";

import { useTranslations } from "next-intl";
import type { EventQuestion } from "@/lib/data/questions";

const control =
  "h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink focus:border-ink focus:outline-none";

/** Vlastní otázky pořadatele ve formuláři přihlášky (pole q_<id>). */
export function QuestionFields({ questions, error }: { questions: EventQuestion[]; error?: string }) {
  const t = useTranslations("Questions");
  if (questions.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-4" data-field="answers">
      <legend className="mb-2 text-sm font-semibold text-ink">{t("formTitle")}</legend>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {questions.map((q) => {
        const name = `q_${q.id}`;
        const label = (
          <span className="text-sm font-medium text-ink">
            {q.label}
            {q.required ? <span className="text-danger"> *</span> : null}
          </span>
        );
        return (
          <label key={q.id} className="flex flex-col gap-1.5">
            {label}
            {q.kind === "text" ? (
              <input name={name} required={q.required} maxLength={500} className={control} />
            ) : q.kind === "number" ? (
              <input
                name={name}
                required={q.required}
                inputMode="decimal"
                pattern="-?[0-9]{1,7}([.,][0-9]{1,2})?"
                className={control}
              />
            ) : (
              <select name={name} required={q.required} defaultValue="" className={control}>
                <option value="">{t("choose")}</option>
                {q.kind === "boolean" ? (
                  <>
                    <option value="true">{t("yes")}</option>
                    <option value="false">{t("no")}</option>
                  </>
                ) : (
                  q.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))
                )}
              </select>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}
