import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSyncForm } from "@/components/AdminSyncForm";
import { AdminReportCard } from "@/components/admin/AdminReportCard";
import { PaginatedTable } from "@/components/PaginatedTable";
import { getAdminUser } from "@/lib/admin/require-admin";
import { fetchAdminReports } from "@/lib/admin/fetch-reports";
import { ADMIN_REPORTS_PAGE_SIZE } from "@/lib/search/constants";
import { clampPage, pageRange, parsePageParam, totalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

function adminPath(page: number): string {
  return page > 1 ? `/admin?page=${page}` : "/admin";
}

export default async function AdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const loc = locale === "hu" ? "hu" : "ro";
  const page = parsePageParam((await searchParams).page);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin" });
  const tPag = await getTranslations({ locale, namespace: "pagination" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const admin = await getAdminUser(supabase);
  if (!admin) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="text-zinc-800">{t("denied")}</p>
      </main>
    );
  }

  const { count } = await supabase
    .from("error_reports")
    .select("id", { count: "exact", head: true });

  const total = count ?? 0;
  const pages = totalPages(total, ADMIN_REPORTS_PAGE_SIZE);
  const safePage = clampPage(page, pages);
  const { from, to } = pageRange(safePage, ADMIN_REPORTS_PAGE_SIZE);

  const reportList = await fetchAdminReports(supabase, { from, to });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950">{t("title")}</h1>
      <section className="mt-8">
        <h2 className="text-lg font-medium text-zinc-950">{t("sync")}</h2>
        <div className="mt-2">
          <AdminSyncForm />
        </div>
      </section>
      <section className="mt-12">
        <PaginatedTable
          items={reportList}
          itemKey={(r) => r.id}
          title={t("reports")}
          countLabel={total > 0 ? t("reportCount", { count: total }) : undefined}
          titleClassName="text-lg font-medium text-zinc-950"
          listClassName="mt-4"
          pagination={{
            page: safePage,
            totalPages: pages,
            hrefForPage: adminPath,
            labels: {
              previous: tPag("previous"),
              next: tPag("next"),
              pageLabel: tPag("pageOf", { page: safePage, total: pages }),
            },
          }}
          empty={<p className="mt-4 text-sm text-zinc-600">{t("reportsEmpty")}</p>}
          renderRow={(r) => (
            <AdminReportCard report={r} locale={loc} showMedicineLink />
          )}
        />
      </section>
    </main>
  );
}
