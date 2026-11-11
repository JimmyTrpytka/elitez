"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

/** Po otevření stránky Upozornění označí vše jako přečtené (jednou). */
export function MarkNotificationsRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!hasUnread || done.current) return;
    done.current = true;
    void markAllNotificationsRead().then(() => router.refresh());
  }, [hasUnread, router]);
  return null;
}
