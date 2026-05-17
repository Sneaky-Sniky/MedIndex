import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/forum/ForumIcons";
import { ForumPostList } from "@/components/forum/ForumPostList";
import { ForumReplyForm } from "@/components/forum/ForumReplyForm";
import { ForumThreadAiStarter } from "@/components/forum/ForumThreadAiStarter";
import { ForumLoginPrompt } from "@/components/forum/ForumLoginPrompt";
import { ensureForumThreadOpeningReplyScheduled } from "@/lib/forum/schedule-ai-reply";
import { formatForumDateShort } from "@/lib/forum/format";
import { FORUM_POSTS_PAGE_SIZE } from "@/lib/search/constants";
import { clampPage, pageRange, parsePageParam, totalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; threadId: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function ForumThreadPage({ params, searchParams }: Props) {
  const { locale, threadId } = await params;
  const page = parsePageParam((await searchParams).page);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "forum" });
  const tPag = await getTranslations({ locale, namespace: "pagination" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: thread, error } = await supabase
    .from("forum_threads")
    .select("id, title, created_at, medicine_cim")
    .eq("id", threadId)
    .maybeSingle();
  if (error || !thread) notFound();

  let medicineName: string | null = null;
  if (thread.medicine_cim) {
    const { data: med } = await supabase
      .from("medicines")
      .select("den_comerciala")
      .eq("cim", thread.medicine_cim)
      .maybeSingle();
    medicineName = med?.den_comerciala ?? null;
  }

  const { count } = await supabase
    .from("forum_posts")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);

  const postTotal = count ?? 0;
  const pages = totalPages(postTotal, FORUM_POSTS_PAGE_SIZE);
  const safePage = clampPage(page, pages);
  const { from, to } = pageRange(safePage, FORUM_POSTS_PAGE_SIZE);

  const { data: posts } = await supabase
    .from("forum_posts")
    .select("id, body, created_at, is_ai_draft")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .range(from, to);

  const postList = posts ?? [];
  const answerLocale = locale === "hu" ? "hu" : "ro";
  let aiReplyPending = false;
  if (postTotal === 0) {
    const outcome = await ensureForumThreadOpeningReplyScheduled(threadId, answerLocale);
    aiReplyPending = outcome === "started" || outcome === "pending";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/forum"
        className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 transition hover:text-emerald-800"
      >
        <ChevronLeftIcon />
        {t("backToForum")}
      </Link>

      <header className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{thread.title}</h1>
        <ThreadMeta
          createdAt={thread.created_at}
          locale={locale}
          medicineName={medicineName}
          medicineCim={thread.medicine_cim}
          replyCount={postTotal}
          replyLabel={postTotal === 1 ? t("reply") : t("replies")}
        />
      </header>

      <ForumThreadAiStarter
        threadId={threadId}
        locale={answerLocale}
        postCount={postTotal}
      />

      <section className="mt-8">
        <ForumPostList
          posts={postList}
          locale={locale}
          threadId={threadId}
          user={user}
          aiReplyPending={aiReplyPending}
          pagination={{
            page: safePage,
            totalPages: pages,
            hrefForPage: (p) => (p > 1 ? `/forum/${threadId}?page=${p}` : `/forum/${threadId}`),
            labels: {
              previous: tPag("previous"),
              next: tPag("next"),
              pageLabel: tPag("pageOf", { page: safePage, total: pages }),
            },
          }}
          labels={{
            aiDraft: t("aiDraft"),
            noPosts: t("noPosts"),
            aiReplyPending: t("aiReplyPending"),
            upvote: t("upvote"),
            downvote: t("downvote"),
          }}
        />
      </section>

      <section className="mt-8">
        {user ? (
          <ForumReplyForm
            threadId={threadId}
            locale={locale}
            labels={{
              replyTitle: t("replyTitle"),
              replyPlaceholder: t("replyPlaceholder"),
              post: t("post"),
            }}
          />
        ) : (
          <ForumLoginPrompt message={t("loginToPost")} signInLabel={t("signIn")} />
        )}
      </section>
    </main>
  );
}

function ThreadMeta({
  createdAt,
  locale,
  medicineName,
  medicineCim,
  replyCount,
  replyLabel,
}: {
  createdAt: string;
  locale: string;
  medicineName: string | null;
  medicineCim: string | null;
  replyCount: number;
  replyLabel: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
      <time dateTime={createdAt}>{formatForumDateShort(createdAt, locale)}</time>
      <span className="text-zinc-300">·</span>
      <span>
        {replyCount} {replyLabel}
      </span>
      {medicineName ? (
        <>
          <span className="text-zinc-300">·</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">
            {medicineName}
          </span>
        </>
      ) : medicineCim ? (
        <>
          <span className="text-zinc-300">·</span>
          <span className="font-mono text-xs text-zinc-500">{medicineCim}</span>
        </>
      ) : null}
    </div>
  );
}
