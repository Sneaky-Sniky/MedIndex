import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureForumThreadOpeningReplyScheduled } from "@/lib/forum/schedule-ai-reply";

const bodySchema = z.object({
  threadId: z.string().uuid(),
  locale: z.enum(["ro", "hu"]),
});

export async function POST(request: Request) {
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

  const outcome = await ensureForumThreadOpeningReplyScheduled(
    parsed.data.threadId,
    parsed.data.locale,
  );
  return NextResponse.json({ ok: true, status: outcome });
}
