"use client";

import { submitErrorReport } from "@/actions/community";

export function ReportErrorForm({
  locale,
  medicineCim,
  slug,
}: {
  locale: string;
  medicineCim: string;
  slug: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Report</h2>
      <form action={submitErrorReport} className="mt-2 space-y-2">
        <input type="hidden" name="cim" value={medicineCim} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="locale" value={locale} />
        <textarea
          name="message"
          rows={3}
          className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400"
          placeholder="Descriere eroare…"
          required
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white"
        >
          Trimite
        </button>
      </form>
    </section>
  );
}
