import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { InteractionsClient } from "@/components/InteractionsClient";

type Props = { params: Promise<{ locale: string }> };

export default async function InteractionsPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "ro" && locale !== "hu") notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ai" });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-950">{t("interactionsTitle")}</h1>
      <div className="mt-6">
        <InteractionsClient locale={locale as "ro" | "hu"} />
      </div>
    </main>
  );
}
