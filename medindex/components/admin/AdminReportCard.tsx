import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AdminReportActions } from "@/components/admin/AdminReportActions";
import { ReportStatusBadge } from "@/components/admin/ReportStatusBadge";
import type { AdminErrorReport, ErrorReportStatus } from "@/lib/admin/reports";
import { formatForumDate } from "@/lib/forum/format";

export async function AdminReportCard({
  report,
  locale,
  slug,
  showMedicineLink = true,
}: {
  report: AdminErrorReport;
  locale: "ro" | "hu";
  slug?: string;
  showMedicineLink?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "admin" });
  const status = report.status as ErrorReportStatus;
  const med = report.medicine;

  return (
    <article className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportStatusBadge status={status} label={t(`status.${status}`)} />
        <time
          dateTime={report.created_at}
          className="text-xs text-zinc-500"
          suppressHydrationWarning
        >
          {formatForumDate(report.created_at, locale)}
        </time>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
        {report.message}
      </p>

      {showMedicineLink && med?.slug ? (
        <Link
          href={`/medicine/${med.slug}`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-medium text-blue-700 ring-1 ring-zinc-200 transition hover:bg-blue-50 hover:ring-blue-200"
        >
          <span className="text-zinc-400" aria-hidden>
            →
          </span>
          {med.den_comerciala}
          {report.medicine_cim ? (
            <span className="font-normal text-zinc-500">· {report.medicine_cim}</span>
          ) : null}
        </Link>
      ) : report.medicine_cim && !med?.slug ? (
        <p className="mt-2 font-mono text-xs text-zinc-500">{report.medicine_cim}</p>
      ) : null}

      <AdminReportActions
        reportId={report.id}
        initialStatus={status}
        initialValidation={report.ai_validation}
        initialValidatedAt={report.ai_validated_at}
        locale={locale}
        slug={slug ?? med?.slug}
      />
    </article>
  );
}
