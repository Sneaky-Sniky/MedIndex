export const SEARCH_PAGE_SIZE = 20;
export const SUBSTITUTE_PAGE_SIZE = 15;
export const REVIEW_PAGE_SIZE = 10;
export const ADMIN_REPORTS_PAGE_SIZE = 20;
export const NOTIFICATIONS_PAGE_SIZE = 15;
export const FORUM_POSTS_PAGE_SIZE = 25;

export type SearchRxFilter = "" | "otc" | "rx";
export type SearchSort = "relevance" | "name" | "atc";

export const SEARCH_RX_FILTERS: SearchRxFilter[] = ["", "otc", "rx"];
export const SEARCH_SORTS: SearchSort[] = ["relevance", "name", "atc"];
