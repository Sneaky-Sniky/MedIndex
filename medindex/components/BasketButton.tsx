"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getBasketSnapshot,
  getServerBasketSnapshot,
  readBasket,
  subscribeBasket,
  writeBasket,
} from "@/lib/basket-storage";

export function BasketButton({
  cim,
  labelAdd,
  labelRemove,
}: {
  cim: string;
  labelAdd: string;
  labelRemove: string;
}) {
  const basketJson = useSyncExternalStore(
    subscribeBasket,
    getBasketSnapshot,
    getServerBasketSnapshot,
  );

  const inBasket = useMemo(() => {
    try {
      const arr = JSON.parse(basketJson) as unknown;
      return Array.isArray(arr) && (arr as string[]).includes(cim);
    } catch {
      return false;
    }
  }, [basketJson, cim]);

  return (
    <button
      type="button"
      onClick={() => {
        const cur = readBasket();
        if (cur.includes(cim)) {
          writeBasket(cur.filter((x) => x !== cim));
        } else {
          writeBasket([...new Set([...cur, cim])]);
        }
      }}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
    >
      {inBasket ? labelRemove : labelAdd}
    </button>
  );
}
