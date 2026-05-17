import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ensureMedicineSummaryScheduled } from "@/lib/ai/schedule-medicine-summary";
import {
  getMedicineSummaryState,
  medicineHasCachedSummary,
  medicineSummaryInProgress,
  pickMedicineSummary,
} from "@/lib/ai/summary-cache";

const bodySchema = z.object({
  medicineCim: z.string().min(1),
  locale: z.enum(["ro", "hu"]).default("ro"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const medicineCim = searchParams.get("medicineCim")?.trim();
  const locale = searchParams.get("locale") === "hu" ? "hu" : "ro";
  if (!medicineCim) {
    return NextResponse.json({ error: "medicineCim required" }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const { summaries, aiSummarizingAt } = await getMedicineSummaryState(
      supabase,
      medicineCim,
    );
    const summary = pickMedicineSummary(locale, summaries);
    if (summary) {
      return NextResponse.json({ status: "ready", summary });
    }
    if (medicineSummaryInProgress(aiSummarizingAt)) {
      return NextResponse.json({ status: "summarizing" });
    }
    return NextResponse.json({ status: "none" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

  const { medicineCim, locale } = parsed.data;
  const supabase = await createClient();

  try {
    const { summaries, aiSummarizingAt } = await getMedicineSummaryState(
      supabase,
      medicineCim,
    );
    const summary = pickMedicineSummary(locale, summaries);
    if (summary) {
      return NextResponse.json({ status: "ready", summary });
    }
    if (medicineSummaryInProgress(aiSummarizingAt)) {
      return NextResponse.json({ status: "summarizing" });
    }
    if (medicineHasCachedSummary(summaries)) {
      return NextResponse.json({
        status: "ready",
        summary: pickMedicineSummary(locale, summaries),
      });
    }

    const outcome = await ensureMedicineSummaryScheduled(medicineCim);
    if (outcome === "ready") {
      const refreshed = await getMedicineSummaryState(supabase, medicineCim);
      return NextResponse.json({
        status: "ready",
        summary: pickMedicineSummary(locale, refreshed.summaries),
      });
    }
    if (outcome === "unavailable") {
      return NextResponse.json(
        { error: "Summary unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json({ status: "summarizing" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
