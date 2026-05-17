import type { SupabaseClient } from "@supabase/supabase-js";

export type SummaryLocale = "ro" | "hu";

export type BilingualSummaries = Record<SummaryLocale, string>;

export async function getCachedMedicineSummaries(
  supabase: SupabaseClient,
  medicineCim: string,
): Promise<{ ro: string | null; hu: string | null }> {
  const { data, error } = await supabase
    .from("medicines")
    .select("ai_summary_ro, ai_summary_hu")
    .eq("cim", medicineCim)
    .maybeSingle();
  if (error) throw error;
  return {
    ro: data?.ai_summary_ro?.trim() || null,
    hu: data?.ai_summary_hu?.trim() || null,
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
    })
    .eq("cim", medicineCim);
  if (error) throw error;
}
