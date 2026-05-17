import { voteForumPost } from "@/actions/community";

export function ForumVoteForm({
  postId,
  threadId,
  locale,
  upvoteLabel = "+1",
  downvoteLabel = "−1",
}: {
  postId: string;
  threadId: string;
  locale: string;
  upvoteLabel?: string;
  downvoteLabel?: string;
}) {
  return (
    <form action={voteForumPost} className="mt-3 flex items-center gap-2">
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        name="vote"
        value="1"
        title={upvoteLabel}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
        aria-label={upvoteLabel}
      >
        ↑
      </button>
      <button
        type="submit"
        name="vote"
        value="-1"
        title={downvoteLabel}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-800"
        aria-label={downvoteLabel}
      >
        ↓
      </button>
    </form>
  );
}
