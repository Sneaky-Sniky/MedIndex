import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createOpenAI, interactionAnalysis } from "@/lib/ai/rag";

const bodySchema = z.object({
  medicineCims: z.array(z.string()).min(2).max(12),
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
    const analysis = await interactionAnalysis({
      openai,
      supabase,
      medicineCims: parsed.data.medicineCims,
      locale: parsed.data.locale,
    });
    return NextResponse.json({ analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
