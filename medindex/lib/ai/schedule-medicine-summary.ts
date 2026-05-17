import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import {
  runMedicineSummaryJob,
  type MedicineSummaryJobParams,
} from "@/lib/ai/run-medicine-summary";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCachedMedicineSummaries,
  medicineSummaryInProgress,
} from "@/lib/ai/summary-cache";

async function executeMedicineSummary(params: MedicineSummaryJobParams): Promise<void> {
  const result = await runMedicineSummaryJob(params);
  if (!result.ok) {
    console.warn("medicine ai summary:", params.medicineCim, result.reason);
  } else if (process.env.NODE_ENV === "development") {
    console.log("[medicine-ai] summary saved for", params.medicineCim);
  }
}

async function enqueueViaHttp(params: MedicineSummaryJobParams): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn("medicine ai summary: CRON_SECRET not set, cannot enqueue");
    return;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) {
    console.warn("medicine ai summary: no Host header, cannot enqueue");
    return;
  }

  const origin = `${proto}://${host}`;
  void fetch(`${origin}/api/internal/medicine-ai-summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  }).catch((err) => {
    console.error("medicine ai summary enqueue:", err);
  });
}

export function scheduleMedicineSummary(params: MedicineSummaryJobParams): void {
  if (process.env.NODE_ENV === "development") {
    void executeMedicineSummary(params);
    return;
  }

  try {
    after(() => executeMedicineSummary(params));
  } catch {
    void enqueueViaHttp(params);
  }
}

/** Claim and enqueue background summarization when none exists yet. */
export async function ensureMedicineSummaryScheduled(
  medicineCim: string,
): Promise<"ready" | "summarizing" | "started" | "unavailable"> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return "unavailable";
  }

  const cached = await getCachedMedicineSummaries(admin, medicineCim);
  if (cached.ro && cached.hu) return "ready";

  const { data: row } = await admin
    .from("medicines")
    .select("ai_summarizing_at")
    .eq("cim", medicineCim)
    .maybeSingle();

  if (medicineSummaryInProgress(row?.ai_summarizing_at ?? null)) {
    return "summarizing";
  }

  const { data: claimed, error } = await admin.rpc("claim_medicine_ai_summary", {
    p_cim: medicineCim,
  });
  if (error) {
    console.error("claim_medicine_ai_summary:", error.message);
    return "unavailable";
  }
  if (!claimed) {
    return "summarizing";
  }

  scheduleMedicineSummary({ medicineCim });
  return "started";
}
