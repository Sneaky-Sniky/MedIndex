"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const localeLabels: Record<(typeof routing.locales)[number], string> = {
  ro: "RO",
  hu: "HU",
};

const localeTitles: Record<(typeof routing.locales)[number], string> = {
  ro: "Română",
  hu: "Magyar",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-zinc-200 p-0.5"
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          title={localeTitles[loc]}
          aria-pressed={locale === loc}
          onClick={() => {
            if (loc !== locale) router.replace(pathname, { locale: loc });
          }}
          className={
            locale === loc
              ? "rounded px-2 py-0.5 text-xs font-medium bg-zinc-900 text-white"
              : "rounded px-2 py-0.5 text-xs font-medium text-zinc-600 hover:text-zinc-900"
          }
        >
          {localeLabels[loc]}
        </button>
      ))}
    </div>
  );
}
