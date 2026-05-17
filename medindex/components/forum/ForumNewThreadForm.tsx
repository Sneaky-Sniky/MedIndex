import { createForumThread } from "@/actions/community";

type Props = {
  locale: string;
  labels: {
    titleLabel: string;
    medicineCimLabel: string;
    medicineCimPlaceholder: string;
    create: string;
  };
};

export function ForumNewThreadForm({ locale, labels }: Props) {
  return (
    <form action={createForumThread} className="space-y-4 px-4 py-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="text-sm font-medium text-zinc-800">{labels.titleLabel}</span>
        <input
          name="title"
          required
          placeholder={labels.titleLabel}
          className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-800">{labels.medicineCimLabel}</span>
        <input
          name="medicine_cim"
          placeholder={labels.medicineCimPlaceholder}
          className="mt-1.5 block w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
        />
      </label>
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
        >
          {labels.create}
        </button>
      </div>
    </form>
  );
}
