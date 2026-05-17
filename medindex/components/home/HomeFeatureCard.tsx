import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/components/home/HomeIcons";
import type { ReactNode } from "react";

type Props = {
  href: "/search" | "/forum" | "/interactions";
  icon: ReactNode;
  title: string;
  description: string;
};

export function HomeFeatureCard({ href, icon, title, description }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      <span className="mt-4 font-medium text-zinc-950">{title}</span>
      <span className="mt-1 flex-1 text-sm leading-relaxed text-zinc-600">{description}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 group-hover:gap-2 transition-[gap]">
        <ArrowRightIcon />
      </span>
    </Link>
  );
}
