import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { SearchHeader } from "@/components/search/SearchHeader";
import { SearchToolbar } from "@/components/search/SearchToolbar";
import { PaginatedTable } from "@/components/PaginatedTable";
import { SearchIcon } from "@/components/home/HomeIcons";
import { SEARCH_PAGE_SIZE } from "@/lib/search/constants";
import { hasSearchFilters, parseSearchParams, searchPath } from "@/lib/search/query";
import { escapeIlikePattern } from "@/lib/forum/escape";
import { clampPage, pageRange, totalPages } from "@/lib/pagination";
import type { MedicineSearchRow } from "@/lib/search/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    atc?: string;
    forma?: string;
    rx?: string;
    sort?: string;
    page?: string;
    seed?: string;
  }>;
};

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const { q, atc, forma, rx, sort, page, seed } = parseSearchParams(sp);
  const filtersActive = hasSearchFilters({ atc, forma, rx });
  const isBrowse = !q && !filtersActive;

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "search" });
  const tHome = await getTranslations({ locale, namespace: "home" });
  const tPag = await getTranslations({ locale, namespace: "pagination" });
  const supabase = await createClient();

  let rows: MedicineSearchRow[] = [];
  let total = 0;
  let loadError = false;

  if (isBrowse) {
    const countRes = await supabase.rpc("count_browse_medicines");
    if (countRes.error) {
      const { count } = await supabase
        .from("medicines")
        .select("cim", { count: "exact", head: true });
      total = count ?? 0;
    } else {
      total = Number(countRes.data ?? 0);
    }

    const pages = totalPages(total, SEARCH_PAGE_SIZE);
    const safePage = clampPage(page, pages);
    const { data, error } = await supabase.rpc("browse_medicines", {
      lim: SEARCH_PAGE_SIZE,
      page_num: safePage,
      seed,
    });

    if (error) {
      const { from, to } = pageRange(safePage, SEARCH_PAGE_SIZE);
      const fallback = await supabase
        .from("medicines")
        .select(
          "cim, den_comerciala, dci, forma_farmaceutica, concentratie, cod_atc, slug",
          { count: "exact" },
        )
        .order("den_comerciala", { ascending: true })
        .range(from, to);
      if (fallback.error) {
        console.error("browse_medicines:", error.message, fallback.error.message);
        loadError = true;
      } else {
        rows = (fallback.data ?? []) as MedicineSearchRow[];
        total = fallback.count ?? total;
      }
    } else if (data) {
      rows = data as MedicineSearchRow[];
    }
  } else {
    const countRes = await supabase.rpc("count_search_medicines", {
      q,
      atc_prefix: atc || null,
      forma_filter: forma || null,
      rx_filter: rx || null,
    });

    if (countRes.error) {
      const fallbackCount = await countSearchFallback(supabase, { q, atc, forma, rx });
      total = fallbackCount.total;
    } else {
      total = Number(countRes.data ?? 0);
    }

    const pages = totalPages(total, SEARCH_PAGE_SIZE);
    const safePage = clampPage(page, pages);

    const { data, error } = await supabase.rpc("search_medicines", {
      q,
      lim: SEARCH_PAGE_SIZE,
      page_num: safePage,
      atc_prefix: atc || null,
      forma_filter: forma || null,
      rx_filter: rx || null,
      sort_by: sort,
    });

    if (error) {
      console.error("search_medicines:", error.message);
      const fallback = await searchMedicinesFallback(supabase, {
        q,
        atc,
        forma,
        rx,
        sort,
        page: safePage,
      });
      if (fallback.error) {
        loadError = true;
      } else {
        rows = fallback.rows;
        total = fallback.total;
      }
    } else if (data) {
      rows = data as MedicineSearchRow[];
    }
  }

  const pages = totalPages(total, SEARCH_PAGE_SIZE);
  const safePage = clampPage(page, pages);
  const mode = isBrowse ? "browse" : "search";
  const resultCount = t("resultCount", { count: total });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 pb-14">
      <SearchHeader badge={tHome("badge")} title={t("title")} subtitle={t("subtitle")} />

      <section className="mt-4">
        <SearchToolbar
          q={q}
          atc={atc}
          forma={forma}
          rx={rx}
          sort={sort}
          seed={isBrowse ? seed : undefined}
          showClear={Boolean(q || filtersActive || sort !== "relevance" || page > 1)}
          labels={{
            placeholder: t("placeholder"),
            filterAtc: t("filterAtc"),
            filterForma: t("filterForma"),
            filterRx: t("filterRx"),
            filterSort: t("filterSort"),
            rxAll: t("rxAll"),
            rxOtc: t("rxOtc"),
            rxPrescription: t("rxPrescription"),
            sortRelevance: t("sortRelevance"),
            sortName: t("sortName"),
            sortAtc: t("sortAtc"),
            submit: t("submit"),
            clearFilters: t("clearFilters"),
          }}
        />
      </section>

      <section className="mt-8">
        {loadError ? (
          <p className="text-sm text-red-600">{t("error")}</p>
        ) : (
          <PaginatedTable
            items={rows}
            itemKey={(r) => r.cim}
            title={mode === "browse" ? t("browseHeading") : t("resultsHeading")}
            countLabel={resultCount}
            className="mt-3"
            pagination={{
              page: safePage,
              totalPages: pages,
              hrefForPage: (p) =>
                searchPath({
                  q,
                  atc,
                  forma,
                  rx,
                  sort,
                  page: p,
                  seed: isBrowse ? seed : undefined,
                }),
              labels: {
                previous: tPag("previous"),
                next: tPag("next"),
                pageLabel: tPag("pageOf", { page: safePage, total: pages }),
              },
            }}
            empty={
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                  <SearchIcon className="h-6 w-6" />
                </div>
                <p className="mt-4 text-base font-medium text-zinc-900">{t("noResults")}</p>
              </div>
            }
            renderRow={(r) => (
              <Link
                href={`/medicine/${r.slug}`}
                className="block px-4 py-3.5 transition hover:bg-zinc-50 sm:px-5"
              >
                <div className="font-medium text-zinc-950">{r.den_comerciala}</div>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {[r.dci, r.cod_atc, r.cim].filter(Boolean).join(" · ")}
                </p>
                {(r.forma_farmaceutica || r.concentratie) && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {[r.forma_farmaceutica, r.concentratie].filter(Boolean).join(" · ")}
                  </p>
                )}
              </Link>
            )}
          />
        )}
      </section>
    </main>
  );
}

async function countSearchFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { q: string; atc: string; forma: string; rx: "" | "otc" | "rx" },
): Promise<{ total: number }> {
  let query = supabase.from("medicines").select("cim, prescriptie", { count: "exact", head: true });

  if (params.q) {
    const pattern = `%${escapeIlikePattern(params.q)}%`;
    query = query.or(
      `den_comerciala.ilike.${pattern},dci.ilike.${pattern},cim.ilike.${pattern},cod_atc.ilike.${pattern}`,
    );
  }
  if (params.atc) {
    query = query.ilike("cod_atc", `${escapeIlikePattern(params.atc)}%`);
  }
  if (params.forma) {
    query = query.ilike("forma_farmaceutica", `%${escapeIlikePattern(params.forma)}%`);
  }

  const { count, error } = await query;
  if (error || count === null) return { total: 0 };
  return { total: count };
}

async function searchMedicinesFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    q: string;
    atc: string;
    forma: string;
    rx: "" | "otc" | "rx";
    sort: "relevance" | "name" | "atc";
    page: number;
  },
): Promise<{ rows: MedicineSearchRow[]; total: number; error?: string }> {
  const { from, to } = pageRange(params.page, SEARCH_PAGE_SIZE);

  let query = supabase
    .from("medicines")
    .select(
      "cim, den_comerciala, dci, forma_farmaceutica, concentratie, cod_atc, slug, prescriptie",
      { count: "exact" },
    );

  if (params.q) {
    const pattern = `%${escapeIlikePattern(params.q)}%`;
    query = query.or(
      `den_comerciala.ilike.${pattern},dci.ilike.${pattern},cim.ilike.${pattern},cod_atc.ilike.${pattern}`,
    );
  }
  if (params.atc) {
    query = query.ilike("cod_atc", `${escapeIlikePattern(params.atc)}%`);
  }
  if (params.forma) {
    query = query.ilike("forma_farmaceutica", `%${escapeIlikePattern(params.forma)}%`);
  }
  if (params.sort === "name") {
    query = query.order("den_comerciala", { ascending: true });
  } else if (params.sort === "atc") {
    query = query.order("cod_atc", { ascending: true });
  } else {
    query = query.order("den_comerciala", { ascending: true });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) return { rows: [], total: 0, error: error.message };
  if (!data) return { rows: [], total: count ?? 0 };

  const rows = (data as (MedicineSearchRow & { prescriptie?: string | null })[])
    .filter((row) => matchesRxFilter(row.prescriptie, params.rx))
    .map(({ prescriptie: _p, ...row }) => row);
  return { rows, total: count ?? rows.length };
}

function matchesRxFilter(prescriptie: string | null | undefined, rx: "" | "otc" | "rx") {
  if (!rx) return true;
  const value = (prescriptie ?? "").toLowerCase();
  if (rx === "otc") return value.includes("fara prescriptie");
  return value.includes("reteta") && !value.includes("fara prescriptie");
}
