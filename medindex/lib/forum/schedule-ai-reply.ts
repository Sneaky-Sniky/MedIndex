import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runForumAiReplyJob,
  type ForumAiReplyParams,
} from "@/lib/forum/run-ai-reply";

async function executeForumAiReply(params: ForumAiReplyParams): Promise<void> {
  const result = await runForumAiReplyJob(params);
  if (!result.ok) {
    console.warn("forum ai reply:", result.reason);
  } else if (process.env.NODE_ENV === "development") {
    console.log("[forum-ai] reply posted for thread", params.threadId);
  }
}

async function enqueueViaHttp(params: ForumAiReplyParams): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn("forum ai reply: CRON_SECRET not set, cannot enqueue");
    return;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) {
    console.warn("forum ai reply: no Host header, cannot enqueue");
    return;
  }

  const origin = `${proto}://${host}`;
  void fetch(`${origin}/api/internal/forum-ai-reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  }).catch((err) => {
    console.error("forum ai reply enqueue:", err);
  });
}

export function scheduleForumAiReply(params: ForumAiReplyParams): void {
  if (process.env.NODE_ENV === "development") {
    void executeForumAiReply(params);
    return;
  }

  try {
    after(() => executeForumAiReply(params));
  } catch {
    void enqueueViaHttp(params);
  }
}

/** Schedule the opening AI reply when a new thread has no posts yet. */
export async function ensureForumThreadOpeningReplyScheduled(
  threadId: string,
  locale: "ro" | "hu",
): Promise<"ready" | "pending" | "started" | "unavailable"> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return "unavailable";
  }

  const { count } = await admin
    .from("forum_posts")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);

  if ((count ?? 0) > 0) return "ready";

  const { data: claimed, error } = await admin.rpc("claim_forum_opening_ai_reply", {
    p_thread_id: threadId,
  });
  if (error) {
    console.error("claim_forum_opening_ai_reply:", error.message);
    return "unavailable";
  }
  if (!claimed) return "pending";

  scheduleForumAiReply({ threadId, locale });
  return "started";
}
