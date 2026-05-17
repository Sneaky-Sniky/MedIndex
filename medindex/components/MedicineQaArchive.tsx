"use client";

import { useTranslations } from "next-intl";
import { AiMarkdown } from "@/components/AiMarkdown";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

export type MedicineQaEntry = {
  id: string;
  question: string;
  answer: string;
  locale: "ro" | "hu";
  created_at: string;
};

export function MedicineQaArchive({ entries }: { entries: MedicineQaEntry[] }) {
  const tMed = useTranslations("medicine");

  if (entries.length === 0) return null;

  return (
    <details className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span>{tMed("previousQuestions", { count: entries.length })}</span>
          <span className="text-zinc-400" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      <ul className="space-y-3 border-t border-zinc-200 px-3 py-3">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-lg border border-zinc-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-sm font-medium text-zinc-950">
                {entry.question}
              </p>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium uppercase text-zinc-600">
                {entry.locale}
              </span>
            </div>
            <div className="mt-2 text-sm text-zinc-800">
              <AiMarkdown text={entry.answer} />
            </div>
            <div className="mt-2">
              <MedicalDisclaimer variant="ai" />
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
