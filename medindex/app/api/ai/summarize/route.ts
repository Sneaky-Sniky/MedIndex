import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiRouteError, createOpenAI } from "@/lib/ai/openai";
import { summarizeLeafletsBilingual } from "@/lib/ai/rag";
import {
  getCachedMedicineSummaries,
  saveMedicineSummaries,
} from "@/lib/ai/summary-cache";

const bodySchema = z.object({
  medicineCim: z.string().min(1),
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
  const { medicineCim, locale } = parsed.data;
  try {
    const cached = await getCachedMedicineSummaries(supabase, medicineCim);
    if (cached[locale]) {
      return NextResponse.json({ summary: cached[locale], cached: true });
    }

    const summaries = await summarizeLeafletsBilingual({
      openai,
      supabase,
      medicineCim,
    });

    try {
      await saveMedicineSummaries(
        createAdminClient(),
        medicineCim,
        summaries,
      );
    } catch {
      // cache optional if service role is not configured
    }

    return NextResponse.json({
      summary: summaries[locale],
      cached: false,
    });
  } catch (e) {
    const { status, error } = aiRouteError(e);
    return NextResponse.json({ error }, { status });
  }
}
