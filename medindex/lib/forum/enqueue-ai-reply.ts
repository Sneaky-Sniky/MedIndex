import "server-only";
import type { ForumAiReplyParams } from "@/lib/forum/run-ai-reply";

function internalJobOrigin(): string | null {
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return app.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT?.trim() || "3000";
    return `http://127.0.0.1:${port}`;
  }
  return null;
}

export function enqueueForumAiReply(params: ForumAiReplyParams): void {
  const secret = process.env.CRON_SECRET?.trim();
  const origin = internalJobOrigin();
  if (!secret || !origin) return;

  void fetch(`${origin}/api/internal/forum-ai-reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  }).catch((err) => {
    console.error("enqueueForumAiReply:", err);
  });
}
