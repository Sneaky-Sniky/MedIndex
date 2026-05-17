import type { SearchRxFilter, SearchSort } from "@/lib/search/constants";
import { SEARCH_RX_FILTERS, SEARCH_SORTS } from "@/lib/search/constants";
import { parsePageParam } from "@/lib/pagination";

export function parseSearchParams(searchParams: {
  q?: string;
  atc?: string;
  forma?: string;
  rx?: string;
  sort?: string;
  page?: string;
  seed?: string;
}) {
  const q = (searchParams.q ?? "").trim();
  const atc = (searchParams.atc ?? "").trim();
  const forma = (searchParams.forma ?? "").trim();
  const rx: SearchRxFilter = SEARCH_RX_FILTERS.includes(searchParams.rx as SearchRxFilter)
    ? (searchParams.rx as SearchRxFilter)
    : "";
  const sort: SearchSort = SEARCH_SORTS.includes(searchParams.sort as SearchSort)
    ? (searchParams.sort as SearchSort)
    : "relevance";
  const page = parsePageParam(searchParams.page);
  const seed = resolveBrowseSeed(searchParams.seed);
  return { q, atc, forma, rx, sort, page, seed };
}

export function resolveBrowseSeed(seed?: string): string {
  const trimmed = (seed ?? "").trim();
  if (/^[a-z0-9]{8,32}$/i.test(trimmed)) return trimmed;
  return randomSeed();
}

export function randomSeed(): string {
  return Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join("");
}

export function hasSearchFilters(params: {
  atc: string;
  forma: string;
  rx: SearchRxFilter;
}): boolean {
  return Boolean(params.atc || params.forma || params.rx);
}

export function buildSearchQueryString(params: {
  q?: string;
  atc?: string;
  forma?: string;
  rx?: SearchRxFilter;
  sort?: SearchSort;
  page?: number;
  seed?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.atc) sp.set("atc", params.atc);
  if (params.forma) sp.set("forma", params.forma);
  if (params.rx) sp.set("rx", params.rx);
  if (params.sort && params.sort !== "relevance") sp.set("sort", params.sort);
  if (params.seed) sp.set("seed", params.seed);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}

export function searchPath(params: {
  q?: string;
  atc?: string;
  forma?: string;
  rx?: SearchRxFilter;
  sort?: SearchSort;
  page?: number;
  seed?: string;
}): string {
  const qs = buildSearchQueryString(params);
  return qs ? `/search?${qs}` : "/search";
}
