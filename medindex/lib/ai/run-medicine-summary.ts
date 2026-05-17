import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOpenAI } from "@/lib/ai/openai";
import { summarizeLeafletsBilingual } from "@/lib/ai/rag";
import {
  getCachedMedicineSummaries,
  saveMedicineSummaries,
} from "@/lib/ai/summary-cache";

export type MedicineSummaryJobParams = {
  medicineCim: string;
};

export async function clearMedicineSummarizingFlag(
  admin: SupabaseClient,
  medicineCim: string,
): Promise<void> {
  const { error } = await admin
    .from("medicines")
    .update({ ai_summarizing_at: null })
    .eq("cim", medicineCim);
  if (error) throw error;
}

export async function runMedicineSummaryJob(
  params: MedicineSummaryJobParams,
): Promise<{ ok: boolean; reason?: string }> {
  const openai = createOpenAI();
  if (!openai) return { ok: false, reason: "openai_not_configured" };

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, reason: "admin_client_unavailable" };
  }

  const { medicineCim } = params;

  try {
    const cached = await getCachedMedicineSummaries(admin, medicineCim);
    if (cached.ro && cached.hu) {
      await clearMedicineSummarizingFlag(admin, medicineCim);
      return { ok: true, reason: "already_cached" };
    }

    const summaries = await summarizeLeafletsBilingual({
      openai,
      supabase: admin,
      admin,
      medicineCim,
    });

    await saveMedicineSummaries(admin, medicineCim, summaries);
    return { ok: true };
  } catch (e) {
    try {
      await clearMedicineSummarizingFlag(admin, medicineCim);
    } catch {
      // best effort
    }
    const msg = e instanceof Error ? e.message : "summary_failed";
    console.error("medicine-ai-summary:", medicineCim, msg);
    return { ok: false, reason: msg };
  }
}
