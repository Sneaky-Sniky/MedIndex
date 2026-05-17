import type { ForumFilter } from "@/lib/forum/constants";

export function parseForumSearchParams(searchParams: {
  q?: string;
  page?: string;
  filter?: string;
}) {
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const filter: ForumFilter =
    searchParams.filter === "medicine" || searchParams.filter === "general"
      ? searchParams.filter
      : "all";
  return { q, page, filter };
}

export function buildForumQueryString(params: {
  q?: string;
  page?: number;
  filter?: ForumFilter;
}): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.filter && params.filter !== "all") sp.set("filter", params.filter);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}

export function forumListPath(params: {
  q?: string;
  page?: number;
  filter?: ForumFilter;
}): string {
  const qs = buildForumQueryString(params);
  return qs ? `/forum?${qs}` : "/forum";
}
