import { getTranslations } from "next-intl/server";
import { AdminReportCard } from "@/components/admin/AdminReportCard";
import type { AdminErrorReport } from "@/lib/admin/reports";

export async function AdminMedicineReportsSection({
  locale,
  slug,
  reports,
}: {
  locale: "ro" | "hu";
  slug: string;
  reports: AdminErrorReport[];
}) {
  const t = await getTranslations({ locale, namespace: "admin" });

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium text-zinc-950">{t("medicineReports")}</h2>
        <p className="text-xs text-zinc-600">
          {t("reportCount", { count: reports.length })}
        </p>
      </div>
      <p className="mt-1 text-sm text-zinc-600">{t("medicineReportsHint")}</p>

      {reports.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">{t("reportsEmpty")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-amber-200/80 overflow-hidden rounded-xl border border-amber-200/80 bg-white">
          {reports.map((report) => (
            <li key={report.id}>
              <AdminReportCard
                report={report}
                locale={locale}
                slug={slug}
                showMedicineLink={false}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
