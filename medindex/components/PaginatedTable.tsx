import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

export type PaginationLabels = {
  previous: string;
  next: string;
  pageLabel: string;
};

export type PaginatedTablePagination = {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  labels: PaginationLabels;
};

type ListVariant = "bordered" | "stack" | "spaced";

const listClassName: Record<ListVariant, string> = {
  bordered:
    "divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm",
  stack: "space-y-3",
  spaced: "space-y-2",
};

type Props<T> = {
  items: T[];
  itemKey: (item: T) => string;
  renderRow: (item: T, index: number) => ReactNode;
  empty: ReactNode;
  pagination: PaginatedTablePagination;
  title?: string;
  countLabel?: string;
  titleClassName?: string;
  variant?: ListVariant;
  listAs?: "ul" | "ol";
  listClassName?: string;
  className?: string;
  rowClassName?: string;
};

export function PaginatedTable<T>({
  items,
  itemKey,
  renderRow,
  empty,
  pagination,
  title,
  countLabel,
  titleClassName = "text-sm font-medium uppercase tracking-wider text-zinc-500",
  variant = "bordered",
  listAs = "ul",
  listClassName: listClassNameOverride,
  className,
  rowClassName,
}: Props<T>) {
  const header =
    title || countLabel ? (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {title ? <h2 className={titleClassName}>{title}</h2> : null}
        {countLabel ? <p className="text-xs text-zinc-500">{countLabel}</p> : null}
      </div>
    ) : null;

  if (!items.length) {
    return (
      <section className={className}>
        {header}
        {empty}
      </section>
    );
  }

  const ListTag = listAs;
  const listClasses = [listClassName[variant], listClassNameOverride].filter(Boolean).join(" ");

  return (
    <section className={className}>
      {header}
      <ListTag className={listClasses}>
        {items.map((item, index) => (
          <li key={itemKey(item)} className={rowClassName}>
            {renderRow(item, index)}
          </li>
        ))}
      </ListTag>
      <TablePagination {...pagination} />
    </section>
  );
}

function TablePagination({
  page,
  totalPages,
  hrefForPage,
  labels,
}: PaginatedTablePagination) {
  if (totalPages <= 1) return null;

  const prevHref = page > 1 ? hrefForPage(page - 1) : null;
  const nextHref = page < totalPages ? hrefForPage(page + 1) : null;

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6"
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

      <p className="text-sm text-zinc-600">{labels.pageLabel}</p>

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
