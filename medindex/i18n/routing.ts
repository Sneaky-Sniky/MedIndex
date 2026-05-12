import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ro", "hu"],
  defaultLocale: "ro",
  localePrefix: "as-needed",
});
