import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export async function Header({ locale }: { locale: "ro" | "hu" }) {
  const t = await getTranslations({ locale, namespace: "nav" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = prof?.role === "admin";
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-zinc-900">
          MedIndex
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/" className="text-zinc-600 hover:text-zinc-900">
            {t("home")}
          </Link>
          <Link href="/search" className="text-zinc-600 hover:text-zinc-900">
            {t("search")}
          </Link>
          <Link href="/forum" className="text-zinc-600 hover:text-zinc-900">
            {t("forum")}
          </Link>
          <Link
            href="/interactions"
            className="text-zinc-600 hover:text-zinc-900"
          >
            {t("interactions")}
          </Link>
          {user ? (
            <Link
              href="/account/notifications"
              className="text-zinc-600 hover:text-zinc-900"
            >
              {t("notifications")}
            </Link>
          ) : null}
          {isAdmin ? (
            <Link href="/admin" className="text-zinc-600 hover:text-zinc-900">
              {t("admin")}
            </Link>
          ) : null}
          {user ? (
            <span className="flex items-center gap-2">
              <span className="max-w-[140px] truncate text-zinc-500">
                {user.email}
              </span>
              <SignOutButton label={t("logout")} />
            </span>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800"
            >
              {t("login")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
