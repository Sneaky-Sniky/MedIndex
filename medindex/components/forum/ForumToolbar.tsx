import type { ForumFilter } from "@/lib/forum/constants";
import { FORUM_FILTERS } from "@/lib/forum/constants";

type Props = {
  q: string;
  filter: ForumFilter;
  labels: {
    searchPlaceholder: string;
    search: string;
    filterAll: string;
    filterMedicine: string;
    filterGeneral: string;
  };
};

const filterLabelKey: Record<
  ForumFilter,
  "filterAll" | "filterMedicine" | "filterGeneral"
> = {
  all: "filterAll",
  medicine: "filterMedicine",
  general: "filterGeneral",
};

export function ForumToolbar({ q, filter, labels }: Props) {
  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1">
        <span className="sr-only">{labels.searchPlaceholder}</span>
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder={labels.searchPlaceholder}
          className="block w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </label>
      <label className="sm:w-44">
        <span className="sr-only">{labels.filterAll}</span>
        <select
          name="filter"
          defaultValue={filter}
          className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        >
          {FORUM_FILTERS.map((f) => (
            <option key={f} value={f}>
              {labels[filterLabelKey[f]]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
      >
        {labels.search}
      </button>
    </form>
  );
}
