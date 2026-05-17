import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "@/components/ReviewForm";
import { PaginatedTable } from "@/components/PaginatedTable";
import { medicinePath } from "@/lib/medicine/query";
import { REVIEW_PAGE_SIZE } from "@/lib/search/constants";
import { clampPage, pageRange, totalPages } from "@/lib/pagination";

export async function ReviewSection({
  locale,
  medicineCim,
  slug,
  reviewPage,
  subPage,
}: {
  locale: string;
  medicineCim: string;
  slug: string;
  reviewPage: number;
  subPage: number;
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "medicine" });
  const tPag = await getTranslations({ locale, namespace: "pagination" });
  const supabase = await createClient();

  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("medicine_cim", medicineCim);

  const total = count ?? 0;
  const pages = totalPages(total, REVIEW_PAGE_SIZE);
  const safePage = clampPage(reviewPage, pages);
  const { from, to } = pageRange(safePage, REVIEW_PAGE_SIZE);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, user_id")
    .eq("medicine_cim", medicineCim)
    .order("created_at", { ascending: false })
    .range(from, to);

  const reviewList = reviews ?? [];

  return (
    <section>
      <PaginatedTable
        items={reviewList}
        itemKey={(r) => r.id}
        title={t("reviews")}
        countLabel={total > 0 ? t("reviewCount", { count: total }) : undefined}
        titleClassName="text-lg font-medium text-zinc-950"
        variant="spaced"
        className="mt-2"
        pagination={{
          page: safePage,
          totalPages: pages,
          hrefForPage: (p) => medicinePath(slug, { subPage, reviewPage: p }),
          labels: {
            previous: tPag("previous"),
            next: tPag("next"),
            pageLabel: tPag("pageOf", { page: safePage, total: pages }),
          },
        }}
        empty={<p className="text-sm text-zinc-600">{t("noReviews")}</p>}
        renderRow={(r) => (
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm">
            <div className="font-medium">
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </div>
            <p className="mt-1 text-zinc-700">{r.body}</p>
          </div>
        )}
      />
      <ReviewForm cim={medicineCim} slug={slug} locale={locale} />
    </section>
  );
}
