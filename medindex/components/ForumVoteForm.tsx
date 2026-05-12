import { voteForumPost } from "@/actions/community";

export function ForumVoteForm({
  postId,
  threadId,
  locale,
}: {
  postId: string;
  threadId: string;
  locale: string;
}) {
  return (
    <form action={voteForumPost} className="mt-1 flex gap-1 text-xs">
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        name="vote"
        value="1"
        className="rounded border border-zinc-200 px-2 py-0.5 hover:bg-zinc-50"
      >
        +1
      </button>
      <button
        type="submit"
        name="vote"
        value="-1"
        className="rounded border border-zinc-200 px-2 py-0.5 hover:bg-zinc-50"
      >
        −1
      </button>
    </form>
  );
}
