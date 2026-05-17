import { createForumPost } from "@/actions/community";

type Props = {
  threadId: string;
  locale: string;
  labels: {
    replyTitle: string;
    replyPlaceholder: string;
    post: string;
  };
};

export function ForumReplyForm({ threadId, locale, labels }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-gradient-to-r from-emerald-50/80 to-white px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">{labels.replyTitle}</h2>
      </div>
      <form action={createForumPost} className="space-y-4 px-5 py-5">
        <input type="hidden" name="thread_id" value={threadId} />
        <input type="hidden" name="locale" value={locale} />
        <textarea
          name="body"
          rows={5}
          required
          placeholder={labels.replyPlaceholder}
          className="block w-full resize-y rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
          >
            {labels.post}
          </button>
        </div>
      </form>
    </section>
  );
}
