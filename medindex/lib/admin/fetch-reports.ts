import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminErrorReport } from "@/lib/admin/reports";

const REPORT_SELECT = `
  id,
  message,
  status,
  created_at,
  medicine_cim,
  ai_validation,
  ai_validated_at,
  medicines ( slug, den_comerciala )
`;

type ReportRow = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  medicine_cim: string | null;
  ai_validation: string | null;
  ai_validated_at: string | null;
  medicines:
    | { slug: string; den_comerciala: string }
    | { slug: string; den_comerciala: string }[]
    | null;
};

function normalizeMedicine(
  medicines: ReportRow["medicines"],
): AdminErrorReport["medicine"] {
  if (!medicines) return null;
  const row = Array.isArray(medicines) ? medicines[0] : medicines;
  if (!row?.slug) return null;
  return { slug: row.slug, den_comerciala: row.den_comerciala };
}

export function mapReportRow(row: ReportRow): AdminErrorReport {
  return {
    id: row.id,
    message: row.message,
    status: row.status as AdminErrorReport["status"],
    created_at: row.created_at,
    medicine_cim: row.medicine_cim,
    ai_validation: row.ai_validation,
    ai_validated_at: row.ai_validated_at,
    medicine: normalizeMedicine(row.medicines),
  };
}

export async function fetchAdminReports(
  supabase: SupabaseClient,
  opts: { from: number; to: number },
): Promise<AdminErrorReport[]> {
  const { data } = await supabase
    .from("error_reports")
    .select(REPORT_SELECT)
    .order("created_at", { ascending: false })
    .range(opts.from, opts.to);

  return (data ?? []).map((row) => mapReportRow(row as ReportRow));
}

export async function fetchMedicineReports(
  supabase: SupabaseClient,
  medicineCim: string,
): Promise<AdminErrorReport[]> {
  const { data } = await supabase
    .from("error_reports")
    .select(REPORT_SELECT)
    .eq("medicine_cim", medicineCim)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => mapReportRow(row as ReportRow));
}
