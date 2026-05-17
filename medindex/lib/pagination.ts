export function parsePageParam(page?: string): number {
  return Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
}

export function totalPages(count: number, pageSize: number): number {
  if (count <= 0) return 1;
  return Math.max(1, Math.ceil(count / pageSize));
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function clampPage(page: number, pages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, pages));
}
