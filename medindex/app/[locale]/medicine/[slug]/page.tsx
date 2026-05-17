import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { MedicineAiPanel } from "@/components/MedicineAiPanel";
import { ReviewSection } from "@/components/ReviewSection";
import { ReportErrorForm } from "@/components/ReportErrorForm";
import { BasketButton } from "@/components/BasketButton";
import { MedicineSubscriptionSection } from "@/components/MedicineSubscriptionSection";
import { PaginatedTable } from "@/components/PaginatedTable";
import { SUBSTITUTE_PAGE_SIZE } from "@/lib/search/constants";
import { medicinePath, parseMedicineListParams } from "@/lib/medicine/query";
import { clampPage, pageRange, totalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ subPage?: string; reviewPage?: string }>;
};

export default async function MedicinePage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { subPage, reviewPage } = parseMedicineListParams(await searchParams);
  if (locale !== "ro" && locale !== "hu") notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "medicine" });
  const tPag = await getTranslations({ locale, namespace: "pagination" });
  const supabase = await createClient();

  const { data: med, error } = await supabase
    .from("medicines")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !med) notFound();

  const codAtc = med.cod_atc as string | null;
  let subs: { cim: string; den_comerciala: string; slug: string }[] = [];
  let subTotal = 0;

  if (codAtc) {
    const { count } = await supabase
      .from("medicines")
      .select("cim", { count: "exact", head: true })
      .eq("cod_atc", codAtc)
      .neq("cim", med.cim);
    subTotal = count ?? 0;

    const subPages = totalPages(subTotal, SUBSTITUTE_PAGE_SIZE);
    const safeSubPage = clampPage(subPage, subPages);
    const { from, to } = pageRange(safeSubPage, SUBSTITUTE_PAGE_SIZE);

    const { data } = await supabase
      .from("medicines")
      .select("cim, den_comerciala, slug")
      .eq("cod_atc", codAtc)
      .neq("cim", med.cim)
      .order("den_comerciala", { ascending: true })
      .range(from, to);
    subs = data ?? [];
  }

  const subPages = totalPages(subTotal, SUBSTITUTE_PAGE_SIZE);
  const safeSubPage = clampPage(subPage, subPages);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <article className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950">{med.den_comerciala}</h1>
          <dl className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-900">{t("dci")}</dt>
              <dd className="text-zinc-800">{med.dci ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">{t("atc")}</dt>
              <dd className="text-zinc-800">{med.cod_atc ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">{t("form")}</dt>
              <dd className="text-zinc-800">{med.forma_farmaceutica ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">{t("holder")}</dt>
              <dd className="text-zinc-800">{med.firma_tara_detinator ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {med.link_rcp ? (
              <a
                className="text-blue-700 underline"
                href={med.link_rcp}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("rcp")}
              </a>
            ) : null}
            {med.link_prospect ? (
              <a
                className="text-blue-700 underline"
                href={med.link_prospect}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("prospect")}
              </a>
            ) : null}
          </div>
        </header>

        <MedicalDisclaimer variant="short" />

        <BasketButton
          cim={med.cim}
          labelAdd={t("basketAdd")}
          labelRemove={t("basketRemove")}
        />

        <MedicineSubscriptionSection locale={locale} medicineCim={med.cim} slug={slug} />

        <MedicineAiPanel locale={locale} medicineCim={med.cim} />

        {codAtc ? (
          <PaginatedTable
            items={subs}
            itemKey={(s) => s.cim}
            title={t("substitutes")}
            countLabel={subTotal > 0 ? t("substituteCount", { count: subTotal }) : undefined}
            titleClassName="text-lg font-medium text-zinc-950"
            listClassName="mt-2"
            pagination={{
              page: safeSubPage,
              totalPages: subPages,
              hrefForPage: (p) => medicinePath(slug, { subPage: p, reviewPage }),
              labels: {
                previous: tPag("previous"),
                next: tPag("next"),
                pageLabel: tPag("pageOf", { page: safeSubPage, total: subPages }),
              },
            }}
            empty={<p className="mt-2 text-sm text-zinc-600">{t("noSubstitutes")}</p>}
            renderRow={(s) => (
              <Link
                href={`/medicine/${s.slug}`}
                className="block px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
              >
                {s.den_comerciala}
              </Link>
            )}
          />
        ) : (
          <section>
            <h2 className="text-lg font-medium text-zinc-950">{t("substitutes")}</h2>
            <p className="mt-2 text-sm text-zinc-600">{t("noSubstitutes")}</p>
          </section>
        )}

        <ReviewSection
          locale={locale}
          medicineCim={med.cim}
          slug={slug}
          reviewPage={reviewPage}
          subPage={subPage}
        />
        <ReportErrorForm locale={locale} medicineCim={med.cim} slug={slug} />
      </article>
    </main>
  );
}
