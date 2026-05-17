"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin/require-admin";
import {
  ERROR_REPORT_STATUSES,
  type ErrorReportStatus,
} from "@/lib/admin/reports";

export async function updateErrorReportStatus(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const admin = await getAdminUser(supabase);
  if (!admin) return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ErrorReportStatus;
  const locale = String(formData.get("locale") ?? "ro");
  const slug = String(formData.get("slug") ?? "").trim();

  if (!id || !ERROR_REPORT_STATUSES.includes(status)) return;

  const { data: report } = await supabase
    .from("error_reports")
    .select("medicine_cim")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("error_reports")
    .update({ status })
    .eq("id", id);
  if (error) return;

  revalidatePath(`/${locale}/admin`);
  if (slug) revalidatePath(`/${locale}/medicine/${slug}`);
  else if (report?.medicine_cim) {
    const { data: med } = await supabase
      .from("medicines")
      .select("slug")
      .eq("cim", report.medicine_cim)
      .maybeSingle();
    if (med?.slug) revalidatePath(`/${locale}/medicine/${med.slug}`);
  }
}
