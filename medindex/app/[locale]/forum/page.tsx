import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { createForumThread } from "@/actions/community";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function ForumPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "forum" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: threads } = await supabase
    .from("forum_threads")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950">{t("title")}</h1>

      {user ? (
        <form action={createForumThread} className="mt-8 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <input type="hidden" name="locale" value={locale} />
          <label className="block text-sm font-medium text-zinc-800">
            {t("titleLabel")}
            <input
              name="title"
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800">
            CIM (opțional)
            <input
              name="medicine_cim"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white"
          >
            {t("create")}
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-zinc-600">{t("loginToPost")}</p>
      )}

      <ul className="mt-8 divide-y rounded-lg border border-zinc-200 bg-white">
        {threads?.length ? (
          threads.map((th) => (
            <li key={th.id}>
              <Link
                href={`/forum/${th.id}`}
                className="block px-4 py-3 text-zinc-900 hover:bg-zinc-50"
              >
                {th.title}
              </Link>
            </li>
          ))
        ) : (
          <li className="px-4 py-6 text-sm text-zinc-600">{t("noThreads")}</li>
        )}
      </ul>
    </main>
  );
}
