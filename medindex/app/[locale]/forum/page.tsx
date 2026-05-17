import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ForumComposer } from "@/components/forum/ForumComposer";
import { ForumNewThreadForm } from "@/components/forum/ForumNewThreadForm";
import { ForumThreadList, type MedicineMeta } from "@/components/forum/ForumThreadList";
import { ForumLoginPrompt } from "@/components/forum/ForumLoginPrompt";
import { ForumToolbar } from "@/components/forum/ForumToolbar";
import { ForumPagination } from "@/components/forum/ForumPagination";
import { FORUM_PAGE_SIZE } from "@/lib/forum/constants";
import { parseForumSearchParams } from "@/lib/forum/query";
import { escapeIlikePattern } from "@/lib/forum/escape";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
};

export default async function ForumPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const { q, page, filter } = parseForumSearchParams(sp);
  const hasActiveFilters = Boolean(q) || filter !== "all";

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "forum" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let countQuery = supabase.from("forum_threads").select("id", { count: "exact", head: true });
  let dataQuery = supabase
    .from("forum_threads")
    .select("id, title, created_at, medicine_cim")
    .order("created_at", { ascending: false });

  if (q) {
    const pattern = `%${escapeIlikePattern(q)}%`;
    const orFilter = `title.ilike.${pattern},medicine_cim.ilike.${pattern}`;
    countQuery = countQuery.or(orFilter);
    dataQuery = dataQuery.or(orFilter);
  }
  if (filter === "medicine") {
    countQuery = countQuery.not("medicine_cim", "is", null);
    dataQuery = dataQuery.not("medicine_cim", "is", null);
  } else if (filter === "general") {
    countQuery = countQuery.is("medicine_cim", null);
    dataQuery = dataQuery.is("medicine_cim", null);
  }

  const { count } = await countQuery;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / FORUM_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * FORUM_PAGE_SIZE;
  const to = from + FORUM_PAGE_SIZE - 1;

  const { data: threads } = await dataQuery.range(from, to);

  const threadList = threads ?? [];
  const threadIds = threadList.map((th) => th.id);
  const postCounts: Record<string, number> = {};

  if (threadIds.length) {
    const { data: postRows } = await supabase
      .from("forum_posts")
      .select("thread_id")
      .in("thread_id", threadIds);
    for (const row of postRows ?? []) {
      postCounts[row.thread_id] = (postCounts[row.thread_id] ?? 0) + 1;
    }
  }

  const cims = [
    ...new Set(threadList.map((th) => th.medicine_cim).filter((c): c is string => Boolean(c))),
  ];
  const medicinesByCim: Record<string, MedicineMeta> = {};

  if (cims.length) {
    const { data: meds } = await supabase
      .from("medicines")
      .select("cim, den_comerciala, slug")
      .in("cim", cims);
    for (const med of meds ?? []) {
      medicinesByCim[med.cim] = med;
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-950">{t("title")}</h1>
          <p className="mt-0.5 text-xs text-zinc-500">{t("threadCount", { count: total })}</p>
        </div>
      </header>

      <section className="mt-4">
        <ForumToolbar
          q={q}
          filter={filter}
          labels={{
            searchPlaceholder: t("searchPlaceholder"),
            search: t("search"),
            filterAll: t("filterAll"),
            filterMedicine: t("filterMedicine"),
            filterGeneral: t("filterGeneral"),
          }}
        />
      </section>

      <section className="mt-4">
        {user ? (
          <ForumComposer
            labels={{
              newThread: t("newThread"),
              collapse: t("collapseComposer"),
            }}
          >
            <ForumNewThreadForm
              locale={locale}
              labels={{
                titleLabel: t("titleLabel"),
                medicineCimLabel: t("medicineCimLabel"),
                medicineCimPlaceholder: t("medicineCimPlaceholder"),
                create: t("create"),
              }}
            />
          </ForumComposer>
        ) : (
          <ForumLoginPrompt message={t("loginToPost")} signInLabel={t("signIn")} />
        )}
      </section>

      <section className="mt-6">
        <ForumThreadList
          threads={threadList}
          postCounts={postCounts}
          medicinesByCim={medicinesByCim}
          locale={locale}
          hasActiveFilters={hasActiveFilters}
          labels={{
            noThreads: t("noThreads"),
            noResults: t("noResults"),
            emptyHint: t("emptyHint"),
            resultsHint: t("resultsHint"),
            replies: t("replies"),
            reply: t("reply"),
          }}
        />
        <ForumPagination
          page={safePage}
          totalPages={totalPages}
          q={q}
          filter={filter}
          labels={{
            previous: t("previous"),
            next: t("next"),
            pageLabel: t("pageOf", { page: safePage, total: totalPages }),
          }}
        />
      </section>
    </main>
  );
}
