"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Constants, type Enums } from "@/lib/supabase/database.types";

export type QuestionDraft = {
  id?: string;
  kind: Enums<"event_question_kind">;
  label: string;
  /** Možnosti výběru, každá na řádku */
  options: string;
  required: boolean;
};

export const MAX_QUESTIONS = 20;

const control =
  "h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink focus:border-ink focus:outline-none";

/** Vlastní otázky v přihlášce – seznam se odešle jako JSON v poli questions_json. */
export function QuestionsEditor({ initial }: { initial: QuestionDraft[] }) {
  const t = useTranslations("Questions");
  const [items, setItems] = useState<QuestionDraft[]>(initial);

  const update = (i: number, patch: Partial<QuestionDraft>) =>
    setItems((cur) => cur.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i: number, dir: -1 | 1) =>
    setItems((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="questions_json" value={JSON.stringify(items)} />
      <p className="text-sm text-ink-soft">{t("editorIntro")}</p>
      {items.map((q, i) => (
        <div key={q.id ?? `new-${i}`} className="flex flex-col gap-3 rounded-control border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              {t("labelLabel")}
              <input
                value={q.label}
                maxLength={200}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder={t("labelPlaceholder")}
                className={control}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              {t("kindLabel")}
              <select
                value={q.kind}
                onChange={(e) => update(i, { kind: e.target.value as QuestionDraft["kind"] })}
                className={control}
              >
                {Constants.public.Enums.event_question_kind.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {q.kind === "choice" ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              {t("optionsLabel")}
              <textarea
                value={q.options}
                rows={3}
                onChange={(e) => update(i, { options: e.target.value })}
                placeholder={t("optionsPlaceholder")}
                className="rounded-control border border-line bg-surface px-3 py-2 text-base font-normal text-ink focus:border-ink focus:outline-none"
              />
            </label>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => update(i, { required: e.target.checked })}
                className="h-5 w-5 accent-ink"
              />
              {t("requiredLabel")}
            </label>
            <div className="flex gap-1 text-sm">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full px-3 py-1 hover:bg-muted disabled:opacity-30" aria-label={t("moveUp")}>
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded-full px-3 py-1 hover:bg-muted disabled:opacity-30" aria-label={t("moveDown")}>
                ↓
              </button>
              <button
                type="button"
                onClick={() => setItems((cur) => cur.filter((_, k) => k !== i))}
                className="rounded-full px-3 py-1 font-semibold text-danger hover:bg-muted"
              >
                {t("remove")}
              </button>
            </div>
          </div>
        </div>
      ))}
      {items.length < MAX_QUESTIONS ? (
        <button
          type="button"
          onClick={() => setItems((cur) => [...cur, { kind: "text", label: "", options: "", required: false }])}
          className="self-start rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-muted"
        >
          + {t("add")}
        </button>
      ) : null}
    </div>
  );
}
