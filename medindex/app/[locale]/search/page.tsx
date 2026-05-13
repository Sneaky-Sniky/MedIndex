import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "search" });
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  let rows: {
    cim: string;
    den_comerciala: string;
    dci: string | null;
    cod_atc: string | null;
    slug: string;
  }[] = [];

  if (q.trim()) {
    const { data, error } = await supabase.rpc("search_medicines", {
      q: q.trim(),
      lim: 40,
    });
    if (error) {
      console.error("search_medicines RPC:", error.message, error);
    }
    if (!error && data) {
      rows = data as typeof rows;
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <form className="mt-6 flex gap-2" method="get" action="">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("placeholder")}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {t("submit")}
        </button>
      </form>

      {!q.trim() ? (
        <p className="mt-8 text-zinc-600">{t("empty")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-zinc-600">{t("noResults")}</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {rows.map((r) => (
            <li key={r.cim}>
              <Link
                href={`/medicine/${r.slug}`}
                className="block px-4 py-3 hover:bg-zinc-50"
              >
                <div className="font-medium">{r.den_comerciala}</div>
                <div className="text-sm text-zinc-500">
                  {[r.dci, r.cod_atc, r.cim].filter(Boolean).join(" · ")}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
