"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AiMarkdown } from "@/components/AiMarkdown";
import { Spinner } from "@/components/Spinner";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import {
  MedicineQaArchive,
  type MedicineQaEntry,
} from "@/components/MedicineQaArchive";
import { createClient } from "@/lib/supabase/client";
import { pickMedicineSummary } from "@/lib/ai/summary-cache";

type SummaryStatus = "ready" | "summarizing" | "none";

export function MedicineAiPanel({
  locale,
  medicineCim,
  initialSummary = null,
  initialSummarizing = false,
  initialQa = [],
}: {
  locale: "ro" | "hu";
  medicineCim: string;
  initialSummary?: string | null;
  initialSummarizing?: boolean;
  initialQa?: MedicineQaEntry[];
}) {
  const tAi = useTranslations("ai");
  const tMed = useTranslations("medicine");
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [isSummarizing, setIsSummarizing] = useState(
    initialSummarizing && !initialSummary,
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qaEntries, setQaEntries] = useState(initialQa);
  const startRequested = useRef(false);

  useEffect(() => {
    setSummary(initialSummary);
    setIsSummarizing(initialSummarizing && !initialSummary);
    startRequested.current = false;
  }, [initialSummary, initialSummarizing, locale, medicineCim]);

  useEffect(() => {
    setQaEntries(initialQa);
  }, [initialQa, locale, medicineCim]);

  const applySummaryFromRow = useCallback(
    (row: {
      ai_summary_ro?: string | null;
      ai_summary_hu?: string | null;
      ai_summarizing_at?: string | null;
    }) => {
      const next = pickMedicineSummary(locale, {
        ro: row.ai_summary_ro ?? null,
        hu: row.ai_summary_hu ?? null,
      });
      if (next) {
        setSummary(next);
        setIsSummarizing(false);
        return;
      }
      if (!row.ai_summarizing_at) {
        setIsSummarizing(false);
      }
    },
    [locale],
  );

  const refreshSummaryStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/ai/summarize?medicineCim=${encodeURIComponent(medicineCim)}&locale=${locale}`,
      );
      const data = (await res.json()) as {
        status?: SummaryStatus;
        summary?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? tAi("requestFailed"));
      if (data.status === "ready" && data.summary) {
        setSummary(data.summary);
        setIsSummarizing(false);
        return;
      }
      if (data.status === "summarizing") {
        setIsSummarizing(true);
      }
    } catch {
      // polling is best-effort
    }
  }, [locale, medicineCim, tAi]);

  const requestSummaryStart = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicineCim, locale }),
      });
      const data = (await res.json()) as {
        status?: SummaryStatus;
        summary?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? tAi("requestFailed"));
      if (data.status === "ready" && data.summary) {
        setSummary(data.summary);
        setIsSummarizing(false);
        return;
      }
      if (data.status === "summarizing") {
        setIsSummarizing(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : tAi("requestFailed"));
      setIsSummarizing(false);
    }
  }, [locale, medicineCim, tAi]);

  useEffect(() => {
    if (summary !== null || isSummarizing || startRequested.current) return;
    startRequested.current = true;
    void requestSummaryStart();
  }, [summary, isSummarizing, requestSummaryStart]);

  useEffect(() => {
    if (!isSummarizing && summary) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`medicine-summary:${medicineCim}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "medicines",
          filter: `cim=eq.${medicineCim}`,
        },
        (payload) => {
          applySummaryFromRow(
            payload.new as {
              ai_summary_ro?: string | null;
              ai_summary_hu?: string | null;
              ai_summarizing_at?: string | null;
            },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applySummaryFromRow, isSummarizing, medicineCim, summary]);

  useEffect(() => {
    if (!isSummarizing) return;
    const id = window.setInterval(() => {
      void refreshSummaryStatus();
    }, 5000);
    return () => window.clearInterval(id);
  }, [isSummarizing, refreshSummaryStatus]);

  async function runChat() {
    if (!question.trim()) return;
    setChatLoading(true);
    setAnswer(null);
    setError(null);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          medicineCim,
          locale,
        }),
      });
      const data = (await res.json()) as {
        answer?: string;
        error?: string;
        qa?: MedicineQaEntry | null;
      };
      if (!res.ok) throw new Error(data.error ?? tAi("requestFailed"));
      setAnswer(data.answer ?? "");
      if (data.qa) {
        setQaEntries((prev) =>
          prev.some((e) => e.id === data.qa!.id) ? prev : [data.qa!, ...prev],
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : tAi("requestFailed"));
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="space-y-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      <section>
        <h2 className="text-lg font-medium text-zinc-950">{tMed("summarize")}</h2>
        {isSummarizing ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
            <Spinner />
            <span>{tMed("summarizeInProgress")}</span>
          </div>
        ) : null}
        {summary !== null ? (
          <details
            className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
            open={!isSummarizing}
          >
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span>{tMed("summarize")}</span>
                <span className="text-zinc-400" aria-hidden>
                  ▾
                </span>
              </span>
            </summary>
            <div className="space-y-2 border-t border-zinc-200 px-3 py-3">
              <div className="text-sm text-zinc-800">
                <AiMarkdown text={summary} />
              </div>
              <MedicalDisclaimer variant="ai" />
            </div>
          </details>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-medium text-zinc-950">{tAi("chatTitle")}</h2>
        <div className="mt-3">
          <MedicineQaArchive entries={qaEntries} />
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={tAi("chatPlaceholder")}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <button
            type="button"
            disabled={chatLoading}
            onClick={() => void runChat()}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {chatLoading ? (
              <>
                <Spinner />
                <span className="sr-only">{tAi("send")}</span>
              </>
            ) : (
              tAi("send")
            )}
          </button>
        </div>
        {answer !== null ? (
          <div className="mt-3 space-y-2">
            <div className="text-sm text-zinc-800">
              <AiMarkdown text={answer} />
            </div>
            <MedicalDisclaimer variant="ai" />
          </div>
        ) : null}
      </section>
    </div>
  );
}
