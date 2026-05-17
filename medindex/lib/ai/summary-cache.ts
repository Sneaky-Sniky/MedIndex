import type { SupabaseClient } from "@supabase/supabase-js";
import {
  pickBilingualContent,
  type AppLocale,
  type BilingualContent,
} from "@/lib/i18n/bilingual";

export type SummaryLocale = AppLocale;

export type BilingualSummaries = Record<SummaryLocale, string>;

const SUMMARY_STALE_MS = 30 * 60 * 1000;

export function medicineSummaryInProgress(
  aiSummarizingAt: string | null,
  now = Date.now(),
): boolean {
  if (!aiSummarizingAt) return false;
  const started = Date.parse(aiSummarizingAt);
  if (Number.isNaN(started)) return false;
  return now - started < SUMMARY_STALE_MS;
}

export function medicineHasCachedSummary(cached: BilingualContent): boolean {
  return Boolean(cached.ro?.trim() && cached.hu?.trim());
}

export function pickMedicineSummary(
  locale: SummaryLocale,
  summaries: BilingualContent,
): string | null {
  return pickBilingualContent(locale, summaries);
}

export async function getCachedMedicineSummaries(
  supabase: SupabaseClient,
  medicineCim: string,
): Promise<{
  ro: string | null;
  hu: string | null;
  aiSummarizingAt: string | null;
}> {
  const { data, error } = await supabase
    .from("medicines")
    .select("ai_summary_ro, ai_summary_hu, ai_summarizing_at")
    .eq("cim", medicineCim)
    .maybeSingle();
  if (error) throw error;
  return {
    ro: data?.ai_summary_ro?.trim() || null,
    hu: data?.ai_summary_hu?.trim() || null,
    aiSummarizingAt: (data?.ai_summarizing_at as string | null) ?? null,
  };
}

export async function getMedicineSummaryState(
  supabase: SupabaseClient,
  medicineCim: string,
): Promise<{
  summaries: BilingualContent;
  aiSummarizingAt: string | null;
}> {
  const row = await getCachedMedicineSummaries(supabase, medicineCim);
  return {
    summaries: { ro: row.ro, hu: row.hu },
    aiSummarizingAt: row.aiSummarizingAt,
  };
}

export async function saveMedicineSummaries(
  supabase: SupabaseClient,
  medicineCim: string,
  summaries: BilingualSummaries,
): Promise<void> {
  const { error } = await supabase
    .from("medicines")
    .update({
      ai_summary_ro: summaries.ro,
      ai_summary_hu: summaries.hu,
      ai_summarizing_at: null,
    })
    .eq("cim", medicineCim);
  if (error) throw error;
}
