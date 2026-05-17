export const BASKET_STORAGE_KEY = "medindex_basket_v1";

export type BasketInteractions = {
  cimsKey: string;
  locale: "ro" | "hu";
  analysis: string;
};

type BasketStored = {
  cims: string[];
  interactions?: BasketInteractions;
};

export function basketCimsKey(cims: string[]): string {
  return [...cims].sort().join("\0");
}

function parseStored(): BasketStored {
  if (typeof window === "undefined") return { cims: [] };
  try {
    const raw = localStorage.getItem(BASKET_STORAGE_KEY);
    if (!raw) return { cims: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { cims: parsed as string[] };
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as BasketStored).cims)
    ) {
      return parsed as BasketStored;
    }
  } catch {
    /* ignore */
  }
  return { cims: [] };
}

function persist(data: BasketStored) {
  localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("medindex-basket-changed"));
}

export function readBasket(): string[] {
  return parseStored().cims;
}

export function readBasketInteractions(
  locale: "ro" | "hu",
): string | null {
  const { cims, interactions } = parseStored();
  if (!interactions) return null;
  if (interactions.locale !== locale) return null;
  if (interactions.cimsKey !== basketCimsKey(cims)) return null;
  return interactions.analysis;
}

export function saveBasketInteractions(
  locale: "ro" | "hu",
  analysis: string,
) {
  const { cims } = parseStored();
  persist({
    cims,
    interactions: {
      cimsKey: basketCimsKey(cims),
      locale,
      analysis,
    },
  });
}

export function writeBasket(cims: string[]) {
  const prev = parseStored();
  const next: BasketStored = { cims };
  if (
    prev.interactions &&
    prev.interactions.cimsKey === basketCimsKey(cims)
  ) {
    next.interactions = prev.interactions;
  }
  persist(next);
}

export function subscribeBasket(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener("medindex-basket-changed", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("medindex-basket-changed", handler);
  };
}

export function getBasketSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return JSON.stringify(readBasket());
}

export function getServerBasketSnapshot(): string {
  return "[]";
}
