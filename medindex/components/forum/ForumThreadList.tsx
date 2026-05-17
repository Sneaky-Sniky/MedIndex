import { Link } from "@/i18n/navigation";
import { formatForumDateShort } from "@/lib/forum/format";
import { MessageIcon } from "@/components/forum/ForumIcons";

export type ForumThreadRow = {
  id: string;
  title: string;
  created_at: string;
  medicine_cim: string | null;
};

export type MedicineMeta = {
  cim: string;
  den_comerciala: string;
  slug: string;
};

type Props = {
  threads: ForumThreadRow[];
  postCounts: Record<string, number>;
  medicinesByCim: Record<string, MedicineMeta>;
  locale: string;
  labels: {
    noThreads: string;
    noResults: string;
    emptyHint: string;
    resultsHint: string;
    replies: string;
    reply: string;
  };
  hasActiveFilters: boolean;
};

export function ForumThreadList({
  threads,
  postCounts,
  medicinesByCim,
  locale,
  labels,
  hasActiveFilters,
}: Props) {
  if (!threads.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
          <MessageIcon className="h-6 w-6" />
        </div>
        <p className="mt-4 text-base font-medium text-zinc-900">
          {hasActiveFilters ? labels.noResults : labels.noThreads}
        </p>
        <p className="mt-1 max-w-sm text-sm text-zinc-600">
          {hasActiveFilters ? labels.resultsHint : labels.emptyHint}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {threads.map((th) => {
        const count = postCounts[th.id] ?? 0;
        const med = th.medicine_cim ? medicinesByCim[th.medicine_cim] : undefined;
        const replyLabel = count === 1 ? labels.reply : labels.replies;

        return (
          <li key={th.id}>
            <Link
              href={`/forum/${th.id}`}
              className="group block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-zinc-950 transition group-hover:text-emerald-900">
                    {th.title}
                  </h3>
                  {med ? (
                    <p className="mt-1.5 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">
                      {med.den_comerciala}
                    </p>
                  ) : th.medicine_cim ? (
                    <p className="mt-1.5 font-mono text-xs text-zinc-500">{th.medicine_cim}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                  {count} {replyLabel}
                </span>
              </div>
              <time
                dateTime={th.created_at}
                className="mt-3 block text-xs text-zinc-500"
              >
                {formatForumDateShort(th.created_at, locale)}
              </time>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
