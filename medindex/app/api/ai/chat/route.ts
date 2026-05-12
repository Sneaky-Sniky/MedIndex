import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createOpenAI, ragAnswer } from "@/lib/ai/rag";

const bodySchema = z.object({
  question: z.string().min(1).max(2000),
  medicineCim: z.string().optional(),
  locale: z.enum(["ro", "hu"]).default("ro"),
});

export async function POST(request: Request) {
  const openai = createOpenAI();
  if (!openai) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 503 },
    );
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
  const supabase = await createClient();
  try {
    const { answer, chunkIds } = await ragAnswer({
      openai,
      supabase,
      userQuestion: parsed.data.question,
      medicineCim: parsed.data.medicineCim,
      answerLocale: parsed.data.locale,
    });
    return NextResponse.json({ answer, chunkIds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
