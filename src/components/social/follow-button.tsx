"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toggleFollow, toggleOrganizerFollow, type SocialError } from "@/lib/social/actions";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Tlačítko Sledovat / Sleduješ + počet sledujících (garáž nebo pořadatel). */
export function FollowButton({
  profileId,
  initialFollowing,
  initialFollowers,
  mode,
  kind = "profile",
}: {
  /** id profilu (garáž) nebo pořadatele */
  profileId: string;
  initialFollowing: boolean;
  initialFollowers: number;
  mode: "active" | "guest" | "own";
  kind?: "profile" | "organizer";
}) {
  const t = useTranslations("Social");
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<SocialError | null>(null);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  const counter = (
    <span className="text-sm text-night-subtle">
      <strong className="font-display text-2xl font-extrabold text-white">{followers}</strong>{" "}
      {t("followersLabel", { count: followers })}
    </span>
  );

  if (mode === "own") return counter;

  const button =
    mode === "guest" ? (
      <Link href="/login" className={buttonClasses("primary")}>
        {t("follow")}
      </Link>
    ) : (
      <button
        type="button"
        disabled={pending}
        aria-pressed={following}
        onClick={() => {
          const prev = { following, followers };
          setFollowing(!following);
          setFollowers(Math.max(0, followers + (following ? -1 : 1)));
          setError(null);
          startTransition(async () => {
            const res =
              kind === "organizer" ? await toggleOrganizerFollow(profileId) : await toggleFollow(profileId);
            if (res.ok) {
              setFollowing(res.following);
              setFollowers(res.followers);
            } else {
              setFollowing(prev.following);
              setFollowers(prev.followers);
              setError(res.error);
            }
          });
        }}
        className={cn(
          buttonClasses(following ? "outlineDark" : "primary"),
          "min-w-32 cursor-pointer disabled:cursor-wait",
        )}
      >
        {following ? t("following") : t("follow")}
      </button>
    );

  return (
    <div className="relative flex flex-wrap items-center gap-4">
      {button}
      {counter}
      {error ? (
        <span role="status" className="absolute top-full left-0 z-20 mt-2 w-60 rounded-control bg-white p-3 text-sm text-ink shadow-xl">
          {t(`errors.${error}`)}
        </span>
      ) : null}
    </div>
  );
}
