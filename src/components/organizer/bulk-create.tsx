"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { bulkCreateEvents } from "@/lib/organizer/actions";

type Row = { title: string; date: string };

/** Hromadné založení eventů do sezóny: řádky „název + datum“ → koncepty. */
export function BulkCreate({ seasonId }: { seasonId: string }) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([
    { title: "", date: "" },
    { title: "", date: "" },
  ]);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function update(index: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await bulkCreateEvents(seasonId, rows);
      if (result.ok) {
        setMessage({ tone: "success", text: t("bulkCreated", { count: result.created }) });
        setRows([
          { title: "", date: "" },
          { title: "", date: "" },
        ]);
        router.refresh();
      } else {
        setMessage({
          tone: "error",
          text: result.error === "empty" ? t("bulkEmpty") : t("bulkFailed"),
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">{t("bulkIntro")}</p>
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_11rem]">
          <input
            aria-label={t("bulkTitleLabel", { n: i + 1 })}
            placeholder={t("bulkTitlePlaceholder")}
            value={row.title}
            maxLength={120}
            onChange={(e) => update(i, { title: e.target.value })}
            className="h-11 rounded-control border border-line px-4 text-base focus:border-ink focus:outline-none"
          />
          <input
            aria-label={t("bulkDateLabel", { n: i + 1 })}
            type="date"
            value={row.date}
            onChange={(e) => update(i, { date: e.target.value })}
            className="h-11 rounded-control border border-line px-3 text-base focus:border-ink focus:outline-none"
          />
        </div>
      ))}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          disabled={rows.length >= 30}
          onClick={() => setRows((r) => [...r, { title: "", date: "" }])}
        >
          {t("bulkAddRow")}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={submit}>
          {pending ? t("bulkCreating") : t("bulkSubmit")}
        </Button>
      </div>
    </div>
  );
}
