"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  threadId: string;
  locale: "ro" | "hu";
  postCount: number;
};

export function ForumThreadAiStarter({ threadId, locale, postCount }: Props) {
  const router = useRouter();
  const startRequested = useRef(false);

  useEffect(() => {
    if (postCount > 0) return;
    if (startRequested.current) return;
    startRequested.current = true;

    void fetch("/api/forum/schedule-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, locale }),
    });
  }, [threadId, locale, postCount]);

  useEffect(() => {
    if (postCount > 0) return;

    const id = window.setInterval(() => {
      router.refresh();
    }, 5000);

    return () => window.clearInterval(id);
  }, [postCount, router]);

  return null;
}
