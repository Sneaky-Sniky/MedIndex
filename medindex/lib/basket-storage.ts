import { pickBilingualContent, type AppLocale } from "@/lib/i18n/bilingual";

export const BASKET_STORAGE_KEY = "medindex_basket_v1";

type BasketInteractionsV2 = {
  cimsKey: string;
  ro?: string;
  hu?: string;
};

/** @deprecated legacy single-locale payload */
type BasketInteractionsV1 = {
  cimsKey: string;
  locale: AppLocale;
  analysis: string;
};

type BasketInteractions = BasketInteractionsV2 | BasketInteractionsV1;

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

function interactionsContent(
  interactions: BasketInteractions,
): { ro: string | null; hu: string | null } {
  if ("analysis" in interactions) {
    return {
      ro: interactions.locale === "ro" ? interactions.analysis : null,
      hu: interactions.locale === "hu" ? interactions.analysis : null,
    };
  }
  return {
    ro: interactions.ro?.trim() || null,
    hu: interactions.hu?.trim() || null,
  };
}

export function readBasket(): string[] {
  return parseStored().cims;
}

export function readBasketInteractions(locale: AppLocale): string | null {
  const { cims, interactions } = parseStored();
  if (!interactions) return null;
  if (interactions.cimsKey !== basketCimsKey(cims)) return null;
  return pickBilingualContent(locale, interactionsContent(interactions));
}

export function saveBasketInteractions(locale: AppLocale, analysis: string) {
  const stored = parseStored();
  const { cims } = stored;
  const cimsKey = basketCimsKey(cims);
  const prev = stored.interactions;
  const content =
    prev && prev.cimsKey === cimsKey
      ? interactionsContent(prev)
      : { ro: null, hu: null };
  content[locale] = analysis;
  persist({
    cims,
    interactions: {
      cimsKey,
      ...(content.ro ? { ro: content.ro } : {}),
      ...(content.hu ? { hu: content.hu } : {}),
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
