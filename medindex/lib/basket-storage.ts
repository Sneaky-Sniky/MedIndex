export const BASKET_STORAGE_KEY = "medindex_basket_v1";

export function readBasket(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BASKET_STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

export function writeBasket(cims: string[]) {
  localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(cims));
  window.dispatchEvent(new Event("medindex-basket-changed"));
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
