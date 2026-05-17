import { Link } from "@/i18n/navigation";
import { forumListPath } from "@/lib/forum/query";
import type { ForumFilter } from "@/lib/forum/constants";

type Props = {
  page: number;
  totalPages: number;
  q: string;
  filter: ForumFilter;
  labels: {
    previous: string;
    next: string;
    pageLabel: string;
  };
};

export function ForumPagination({ page, totalPages, q, filter, labels }: Props) {
  if (totalPages <= 1) return null;

  const prevHref =
    page > 1 ? forumListPath({ q, filter, page: page - 1 }) : null;
  const nextHref =
    page < totalPages ? forumListPath({ q, filter, page: page + 1 }) : null;

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6"
      aria-label="Pagination"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
        >
          {labels.previous}
        </Link>
      ) : (
        <span className="rounded-lg border border-transparent px-3 py-1.5 text-sm text-zinc-400">
          {labels.previous}
        </span>
      )}

      <p className="text-sm text-zinc-600">
        {labels.pageLabel}
      </p>

      {nextHref ? (
        <Link
          href={nextHref}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
        >
          {labels.next}
        </Link>
      ) : (
        <span className="rounded-lg border border-transparent px-3 py-1.5 text-sm text-zinc-400">
          {labels.next}
        </span>
      )}
    </nav>
  );
}
