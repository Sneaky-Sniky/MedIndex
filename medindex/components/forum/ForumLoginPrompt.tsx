import { Link } from "@/i18n/navigation";

type Props = {
  message: string;
  signInLabel: string;
};

export function ForumLoginPrompt({ message, signInLabel }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 px-5 py-6 shadow-sm">
      <p className="text-sm text-zinc-700">{message}</p>
      <Link
        href="/login"
        className="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
      >
        {signInLabel}
      </Link>
    </div>
  );
}
