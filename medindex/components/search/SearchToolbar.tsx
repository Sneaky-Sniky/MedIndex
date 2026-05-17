import { SearchIcon } from "@/components/home/HomeIcons";
import { Link } from "@/i18n/navigation";
import type { SearchRxFilter, SearchSort } from "@/lib/search/constants";
import { SEARCH_RX_FILTERS, SEARCH_SORTS } from "@/lib/search/constants";

type Props = {
  q: string;
  atc: string;
  forma: string;
  rx: SearchRxFilter;
  sort: SearchSort;
  seed?: string;
  labels: {
    placeholder: string;
    filterAtc: string;
    filterForma: string;
    filterRx: string;
    filterSort: string;
    rxAll: string;
    rxOtc: string;
    rxPrescription: string;
    sortRelevance: string;
    sortName: string;
    sortAtc: string;
    submit: string;
    clearFilters: string;
  };
  showClear: boolean;
};

const rxLabelKey: Record<SearchRxFilter, "rxAll" | "rxOtc" | "rxPrescription"> = {
  "": "rxAll",
  otc: "rxOtc",
  rx: "rxPrescription",
};

const sortLabelKey: Record<SearchSort, "sortRelevance" | "sortName" | "sortAtc"> = {
  relevance: "sortRelevance",
  name: "sortName",
  atc: "sortAtc",
};

export function SearchToolbar({
  q,
  atc,
  forma,
  rx,
  sort,
  seed,
  labels,
  showClear,
}: Props) {
  return (
    <form method="get" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      {seed ? <input type="hidden" name="seed" value={seed} /> : null}
      <div className="flex flex-col gap-3">
        <label className="min-w-0">
          <span className="sr-only">{labels.placeholder}</span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              name="q"
              type="search"
              defaultValue={q}
              autoComplete="off"
              placeholder={labels.placeholder}
              className="block w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs font-medium text-zinc-600">{labels.filterAtc}</span>
            <input
              name="atc"
              defaultValue={atc}
              placeholder="N02"
              className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-zinc-600">{labels.filterForma}</span>
            <input
              name="forma"
              defaultValue={forma}
              placeholder="comprimate"
              className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-zinc-600">{labels.filterRx}</span>
            <select
              name="rx"
              defaultValue={rx}
              className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              {SEARCH_RX_FILTERS.map((value) => (
                <option key={value || "all"} value={value}>
                  {labels[rxLabelKey[value]]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-zinc-600">{labels.filterSort}</span>
            <select
              name="sort"
              defaultValue={sort}
              className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              {SEARCH_SORTS.map((value) => (
                <option key={value} value={value}>
                  {labels[sortLabelKey[value]]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            <SearchIcon className="h-4 w-4" />
            {labels.submit}
          </button>
          {showClear ? (
            <Link
              href="/search"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              {labels.clearFilters}
            </Link>
          ) : null}
        </div>
      </div>
    </form>
  );
}
