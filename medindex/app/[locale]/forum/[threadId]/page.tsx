import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createForumPost } from "@/actions/community";
import { ForumVoteForm } from "@/components/ForumVoteForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; threadId: string }> };

export default async function ForumThreadPage({ params }: Props) {
  const { locale, threadId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "forum" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: thread, error } = await supabase
    .from("forum_threads")
    .select("id, title")
    .eq("id", threadId)
    .maybeSingle();
  if (error || !thread) notFound();

  const { data: posts } = await supabase
    .from("forum_posts")
    .select("id, body, created_at, is_ai_draft")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{thread.title}</h1>
      <ul className="mt-6 space-y-3">
        {(posts ?? []).map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            {p.is_ai_draft ? (
              <span className="text-xs text-amber-700">[AI draft]</span>
            ) : null}
            <p className="whitespace-pre-wrap text-zinc-800">{p.body}</p>
            {user ? (
              <ForumVoteForm postId={p.id} threadId={threadId} locale={locale} />
            ) : null}
          </li>
        ))}
      </ul>

      {user ? (
        <form
          action={createForumPost}
          className="mt-8 space-y-2 rounded-lg border border-dashed border-zinc-300 p-4"
        >
          <input type="hidden" name="thread_id" value={threadId} />
          <input type="hidden" name="locale" value={locale} />
          <textarea
            name="body"
            rows={4}
            required
            className="block w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white"
          >
            Post
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-zinc-600">{t("loginToPost")}</p>
      )}
    </main>
  );
}
