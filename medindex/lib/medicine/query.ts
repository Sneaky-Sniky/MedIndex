import { parsePageParam } from "@/lib/pagination";

export function parseMedicineListParams(searchParams: {
  subPage?: string;
  reviewPage?: string;
}) {
  return {
    subPage: parsePageParam(searchParams.subPage),
    reviewPage: parsePageParam(searchParams.reviewPage),
  };
}

export function medicinePath(
  slug: string,
  params?: { subPage?: number; reviewPage?: number },
): string {
  const sp = new URLSearchParams();
  if (params?.subPage && params.subPage > 1) sp.set("subPage", String(params.subPage));
  if (params?.reviewPage && params.reviewPage > 1) {
    sp.set("reviewPage", String(params.reviewPage));
  }
  const qs = sp.toString();
  return qs ? `/medicine/${slug}?${qs}` : `/medicine/${slug}`;
}
