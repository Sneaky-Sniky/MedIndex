"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { AiMarkdown } from "@/components/AiMarkdown";
import { Spinner } from "@/components/Spinner";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import {
  getBasketSnapshot,
  getServerBasketSnapshot,
  readBasket,
  readBasketInteractions,
  saveBasketInteractions,
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = readBasketInteractions(locale);
    setOut(cached);
    if (cached === null) setError(null);
  }, [basketJson, locale]);

  async function analyze() {
    const list = readBasket();
    if (list.length < 2) {
      setOut(null);
      return;
    }
    setLoading(true);
    setOut(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicineCims: list, locale }),
      });
      const data = (await res.json()) as { analysis?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? t("requestFailed"));
      const analysis = data.analysis ?? "";
      saveBasketInteractions(locale, analysis);
      setOut(analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("requestFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-zinc-600">{t("interactionsHint")}</p>
      {cims.length === 0 ? (
        <p className="text-sm text-amber-800">{t("emptyBasket")}</p>
      ) : (
        <>
          <ul className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
            {cims.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {cims.length < 2 ? (
            <p className="text-sm text-amber-800">{t("interactionsNeedTwo")}</p>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => void analyze()}
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Spinner />
                  <span className="sr-only">{t("analyze")}</span>
                </>
              ) : (
                t("analyze")
              )}
            </button>
          )}
        </>
      )}
      {out !== null ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
            <AiMarkdown text={out} />
          </div>
          <MedicalDisclaimer variant="ai" />
        </div>
      ) : null}
    </div>
  );
}
