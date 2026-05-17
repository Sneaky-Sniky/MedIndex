import { reportStatusClasses, type ErrorReportStatus } from "@/lib/admin/reports";

export function ReportStatusBadge({
  status,
  label,
}: {
  status: ErrorReportStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${reportStatusClasses(status)}`}
    >
      {label}
    </span>
  );
}
