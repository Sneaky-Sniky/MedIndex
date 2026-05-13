"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import {
  getBasketSnapshot,
  getServerBasketSnapshot,
  readBasket,
  subscribeBasket,
} from "@/lib/basket-storage";

export function InteractionsClient({ locale }: { locale: "ro" | "hu" }) {
  const t = useTranslations("ai");
  const basketJson = useSyncExternalStore(
    subscribeBasket,
    getBasketSnapshot,
    getServerBasketSnapshot,
  );

  const cims = useMemo(() => {
    try {
      const arr = JSON.parse(basketJson) as unknown;
      return Array.isArray(arr) ? (arr as string[]) : [];
    } catch {
      return [];
    }
  }, [basketJson]);

  const [out, setOut] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    const list = readBasket();
    if (list.length < 2) {
      setOut(null);
      return;
    }
    setLoading(true);
    setOut(null);
    try {
      const res = await fetch("/api/ai/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicineCims: list, locale }),
      });
      const data = (await res.json()) as { analysis?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "err");
      setOut(data.analysis ?? "");
    } catch {
      setOut("—");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">{t("interactionsHint")}</p>
      {cims.length < 2 ? (
        <p className="text-sm text-amber-800">{t("emptyBasket")}</p>
      ) : (
        <>
          <ul className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
            {cims.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            type="button"
            disabled={loading}
            onClick={() => void analyze()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "…" : t("analyze")}
          </button>
        </>
      )}
      {out !== null ? (
        <div className="space-y-2">
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-sm">
            {out}
          </div>
          <MedicalDisclaimer variant="ai" />
        </div>
      ) : null}
    </div>
  );
}
