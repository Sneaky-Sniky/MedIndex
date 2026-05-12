"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

export function MedicineAiPanel({
  locale,
  medicineCim,
}: {
  locale: "ro" | "hu";
  medicineCim: string;
}) {
  const tAi = useTranslations("ai");
  const tMed = useTranslations("medicine");
  const [summary, setSummary] = useState<string | null>(null);
  const [sumLoading, setSumLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  async function runSummary() {
    setSumLoading(true);
    setSummary(null);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicineCim, locale }),
      });
      const data = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "err");
      setSummary(data.summary ?? "");
    } catch {
      setSummary("—");
    } finally {
      setSumLoading(false);
    }
  }

  async function runChat() {
    if (!question.trim()) return;
    setChatLoading(true);
    setAnswer(null);
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
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "err");
      setAnswer(data.answer ?? "");
    } catch {
      setAnswer("—");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="space-y-8 rounded-xl border border-zinc-200 bg-white p-4">
      <section>
        <h2 className="text-lg font-medium">{tMed("summarize")}</h2>
        <button
          type="button"
          disabled={sumLoading}
          onClick={() => void runSummary()}
          className="mt-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {sumLoading ? "…" : tMed("summarize")}
        </button>
        {summary !== null ? (
          <div className="mt-3 space-y-2">
            <div className="whitespace-pre-wrap text-sm text-zinc-800">
              {summary}
            </div>
            <MedicalDisclaimer variant="ai" />
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-medium">{tAi("chatTitle")}</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={tAi("chatPlaceholder")}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={chatLoading}
            onClick={() => void runChat()}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {chatLoading ? "…" : tAi("send")}
          </button>
        </div>
        {answer !== null ? (
          <div className="mt-3 space-y-2">
            <div className="whitespace-pre-wrap text-sm text-zinc-800">
              {answer}
            </div>
            <MedicalDisclaimer variant="ai" />
          </div>
        ) : null}
      </section>
    </div>
  );
}
