import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { HomeFeatureCard } from "@/components/home/HomeFeatureCard";
import { ForumIcon, InteractionsIcon, SearchIcon } from "@/components/home/HomeIcons";

type Props = { params: Promise<{ locale: string }> };

function searchAction(locale: string) {
  return locale === routing.defaultLocale ? "/search" : `/${locale}/search`;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tSearch = await getTranslations("search");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 pb-14 sm:py-12">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-white px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            {t("badge")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-zinc-600">{t("subtitle")}</p>

          <form
            method="get"
            action={searchAction(locale)}
            className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-stretch"
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">{tSearch("placeholder")}</span>
              <input
                name="q"
                type="search"
                autoComplete="off"
                placeholder={tSearch("placeholder")}
                className="block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 sm:shrink-0"
            >
              <SearchIcon className="h-4 w-4" />
              {tSearch("submit")}
            </button>
          </form>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="home-features-heading">
        <h2
          id="home-features-heading"
          className="text-sm font-medium uppercase tracking-wider text-zinc-500"
        >
          {t("featuresTitle")}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <HomeFeatureCard
            href="/search"
            icon={<SearchIcon />}
            title={t("featureSearchTitle")}
            description={t("featureSearchDesc")}
          />
          <HomeFeatureCard
            href="/forum"
            icon={<ForumIcon />}
            title={t("featureForumTitle")}
            description={t("featureForumDesc")}
          />
          <HomeFeatureCard
            href="/interactions"
            icon={<InteractionsIcon />}
            title={t("featureInteractionsTitle")}
            description={t("featureInteractionsDesc")}
          />
        </div>
      </section>

      <div className="mt-10">
        <MedicalDisclaimer />
      </div>
    </main>
  );
}
