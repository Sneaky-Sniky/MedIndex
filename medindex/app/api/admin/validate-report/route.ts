import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin/require-admin";
import { aiRouteError, createOpenAI } from "@/lib/ai/openai";
import { validateErrorReport } from "@/lib/ai/validate-error-report";
import { ensureMedicineSummaryScheduled } from "@/lib/ai/schedule-medicine-summary";

const bodySchema = z.object({
  reportId: z.string().uuid(),
  locale: z.enum(["ro", "hu"]).default("ro"),
});

async function adminApiMessages(locale: "ro" | "hu") {
  const t = await getTranslations({ locale, namespace: "admin" });
  return {
    forbidden: t("apiForbidden"),
    openAiMissing: t("apiOpenAiMissing"),
    invalidJson: t("apiInvalidJson"),
    invalidBody: t("apiInvalidBody"),
    reportNotFound: t("apiReportNotFound"),
    saveFailed: t("apiSaveFailed"),
    aiFailed: t("apiAiFailed"),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await getAdminUser(supabase);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    const msg = await adminApiMessages("ro");
    return NextResponse.json({ error: msg.invalidJson }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  const locale = parsed.success ? parsed.data.locale : "ro";
  const msg = await adminApiMessages(locale);

  if (!admin) {
    return NextResponse.json({ error: msg.forbidden }, { status: 403 });
  }

  const openai = createOpenAI();
  if (!openai) {
    return NextResponse.json({ error: msg.openAiMissing }, { status: 503 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: msg.invalidBody }, { status: 400 });
  }

  const { data: report, error: fetchError } = await supabase
    .from("error_reports")
    .select("id, message, medicine_cim")
    .eq("id", parsed.data.reportId)
    .maybeSingle();

  if (fetchError || !report) {
    return NextResponse.json({ error: msg.reportNotFound }, { status: 404 });
  }

  try {
    const validation = await validateErrorReport({
      openai,
      supabase,
      message: report.message as string,
      medicineCim: (report.medicine_cim as string | null) ?? null,
      locale: parsed.data.locale,
    });

    const validatedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("error_reports")
      .update({
        ai_validation: validation,
        ai_validated_at: validatedAt,
        status: "reviewing",
      })
      .eq("id", report.id);

    if (updateError) {
      return NextResponse.json({ error: msg.saveFailed }, { status: 500 });
    }

    if (report.medicine_cim) {
      void ensureMedicineSummaryScheduled(report.medicine_cim as string);
    }

    return NextResponse.json({
      validation,
      validatedAt,
      status: "reviewing" as const,
    });
  } catch {
    const { status } = aiRouteError(new Error("ai"));
    return NextResponse.json({ error: msg.aiFailed }, { status });
  }
}
