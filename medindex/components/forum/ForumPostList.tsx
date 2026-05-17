import { formatForumDate } from "@/lib/forum/format";
import { ForumVoteForm } from "@/components/ForumVoteForm";

export type ForumPostRow = {
  id: string;
  body: string;
  created_at: string;
  is_ai_draft: boolean;
};

type Props = {
  posts: ForumPostRow[];
  locale: string;
  threadId: string;
  user: { id: string } | null;
  labels: {
    aiDraft: string;
    noPosts: string;
    upvote: string;
    downvote: string;
  };
};

export function ForumPostList({ posts, locale, threadId, user, labels }: Props) {
  if (!posts.length) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-sm text-zinc-600">
        {labels.noPosts}
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {posts.map((p, index) => (
        <li
          key={p.id}
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="flex gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800"
              aria-hidden
            >
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <time dateTime={p.created_at} className="text-xs text-zinc-500">
                  {formatForumDate(p.created_at, locale)}
                </time>
                {p.is_ai_draft ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                    {labels.aiDraft}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                {p.body}
              </p>
              {user ? (
                <ForumVoteForm
                  postId={p.id}
                  threadId={threadId}
                  locale={locale}
                  upvoteLabel={labels.upvote}
                  downvoteLabel={labels.downvote}
                />
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}