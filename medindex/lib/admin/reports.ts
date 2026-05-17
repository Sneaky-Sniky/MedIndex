export type ErrorReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export const ERROR_REPORT_STATUSES: ErrorReportStatus[] = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
];

export type AdminErrorReport = {
  id: string;
  message: string;
  status: ErrorReportStatus;
  created_at: string;
  medicine_cim: string | null;
  ai_validation: string | null;
  ai_validated_at: string | null;
  medicine?: {
    slug: string;
    den_comerciala: string;
  } | null;
};

export function reportStatusClasses(status: ErrorReportStatus): string {
  switch (status) {
    case "open":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "reviewing":
      return "bg-blue-50 text-blue-900 ring-blue-200";
    case "resolved":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "dismissed":
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}
