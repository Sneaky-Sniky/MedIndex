"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-zinc-600 underline hover:text-zinc-900"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
