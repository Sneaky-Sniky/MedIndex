"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    if (!email) return;
    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/${locale}`,
      },
    });
    setMsg(error ? t("error") : t("sent"));
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-3">
      <label className="block text-sm font-medium text-zinc-800">
        {t("email")}
        <input
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded bg-zinc-900 py-2 text-sm text-white"
      >
        {t("magicLink")}
      </button>
      {msg ? <p className="text-sm text-zinc-600">{msg}</p> : null}
    </form>
  );
}
