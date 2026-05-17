import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { unsubscribeFromMedicine, updateNotificationPreferences } from "@/actions/community";
import { PaginatedTable } from "@/components/PaginatedTable";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/search/constants";
import { clampPage, pageRange, parsePageParam, totalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

function notificationsPath(page: number): string {
  return page > 1 ? `/account/notifications?page=${page}` : "/account/notifications";
}

export default async function NotificationsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const page = parsePageParam((await searchParams).page);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "notifications" });
  const tPag = await getTranslations({ locale, namespace: "pagination" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_recalls, push_recalls")
    .eq("user_id", user.id)
    .maybeSingle();

  const { count } = await supabase
    .from("medicine_subscriptions")
    .select("medicine_cim", { count: "exact", head: true })
    .eq("user_id", user.id);

  const total = count ?? 0;
  const pages = totalPages(total, NOTIFICATIONS_PAGE_SIZE);
  const safePage = clampPage(page, pages);
  const { from, to } = pageRange(safePage, NOTIFICATIONS_PAGE_SIZE);

  const { data: followed } = await supabase
    .from("medicine_subscriptions")
    .select("medicine_cim, medicines (den_comerciala, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const followedList = (followed ?? []).flatMap((row) => {
    const raw = row.medicines;
    const med = (Array.isArray(raw) ? raw[0] : raw) as
      | { den_comerciala: string; slug: string }
      | null
      | undefined;
    if (!med) return [];
    return [{ medicine_cim: row.medicine_cim, ...med }];
  });

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950">{t("title")}</h1>
      <section className="mt-10">
        <PaginatedTable
          items={followedList}
          itemKey={(row) => row.medicine_cim}
          title={t("followedMedicines")}
          countLabel={total > 0 ? t("followedCount", { count: total }) : undefined}
          titleClassName="text-lg font-medium text-zinc-950"
          listClassName="mt-3"
          pagination={{
            page: safePage,
            totalPages: pages,
            hrefForPage: notificationsPath,
            labels: {
              previous: tPag("previous"),
              next: tPag("next"),
              pageLabel: tPag("pageOf", { page: safePage, total: pages }),
            },
          }}
          empty={<p className="mt-2 text-sm text-zinc-600">{t("noFollowedMedicines")}</p>}
          renderRow={(row) => (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <Link
                href={`/medicine/${row.slug}`}
                className="text-zinc-900 underline decoration-zinc-300 hover:decoration-zinc-600"
              >
                {row.den_comerciala}
              </Link>
              <form action={unsubscribeFromMedicine}>
                <input type="hidden" name="cim" value={row.medicine_cim} />
                <input type="hidden" name="slug" value="" />
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  {t("unfollow")}
                </button>
              </form>
            </div>
          )}
        />
      </section>
      <form action={updateNotificationPreferences} className="mt-10 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="email_recalls"
            defaultChecked={prefs?.email_recalls ?? true}
          />
          {t("emailRecalls")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="push_recalls"
            defaultChecked={prefs?.push_recalls ?? false}
          />
          {t("pushRecalls")}
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          {t("save")}
        </button>
      </form>
    </main>
  );
}
