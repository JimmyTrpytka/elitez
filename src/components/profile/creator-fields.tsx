"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CREATOR_SKILLS } from "@/lib/portfolio/skills";
import { cn } from "@/lib/cn";

/** Přepínač „Jsem Creator“ a co tvořím (foto / video / dron). */
export function CreatorFields({
  initialCreator,
  initialSkills,
}: {
  initialCreator: boolean;
  initialSkills: string[];
}) {
  const t = useTranslations("Creator");
  const [creator, setCreator] = useState(initialCreator);
  return (
    <fieldset
      className={cn(
        "flex flex-col gap-4 rounded-card border p-4 sm:p-5",
        creator ? "border-ink bg-muted" : "border-line",
      )}
    >
      <legend className="sr-only">{t("legend")}</legend>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="is_creator"
          checked={creator}
          onChange={(e) => setCreator(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
        />
        <span>
          <span className="font-semibold">{t("toggle")}</span>
          <span className="block text-ink-soft">{t("toggleHint")}</span>
        </span>
      </label>
      {creator ? (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">{t("skillsLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {CREATOR_SKILLS.map((skill) => (
              <label
                key={skill}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white"
              >
                <input
                  type="checkbox"
                  name="creator_skills"
                  value={skill}
                  defaultChecked={initialSkills.includes(skill)}
                  className="sr-only"
                />
                {t(`skills.${skill}`)}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
