import { NextResponse } from "next/server";
import { z } from "zod";
import { runForumAiReplyJob } from "@/lib/forum/run-ai-reply";

export const maxDuration = 120;

const bodySchema = z.object({
  threadId: z.string().uuid(),
  triggerPostId: z.string().uuid(),
  locale: z.enum(["ro", "hu"]),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return unauthorized();
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await runForumAiReplyJob(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Job failed";
    console.error("forum-ai-reply:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
