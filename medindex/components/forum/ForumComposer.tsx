"use client";

import { useState } from "react";

type Props = {
  labels: {
    newThread: string;
    collapse: string;
  };
  children: React.ReactNode;
};

export function ForumComposer({ labels, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
      >
        <span>{open ? labels.collapse : labels.newThread}</span>
        <span
          className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? <div className="border-t border-zinc-100">{children}</div> : null}
    </section>
  );
}
