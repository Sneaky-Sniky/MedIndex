"use client";

import { submitReview } from "@/actions/community";

export function ReviewForm({
  cim,
  slug,
  locale,
}: {
  cim: string;
  slug: string;
  locale: string;
}) {
  return (
    <form action={submitReview} className="mt-4 space-y-3 rounded-lg border border-dashed border-zinc-300 bg-white p-4 shadow-sm">
      <input type="hidden" name="cim" value={cim} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="locale" value={locale} />
      <label className="block text-sm">
        <span className="font-medium text-zinc-800">Rating</span>
        <select
          name="rating"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
          defaultValue="5"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-800">Text</span>
        <textarea
          name="body"
          rows={3}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
          required
        />
      </label>
      <button
        type="submit"
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white"
      >
        Save
      </button>
    </form>
  );
}
