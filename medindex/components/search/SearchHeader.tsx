type Props = {
  badge: string;
  title: string;
  subtitle: string;
};

export function SearchHeader({ badge, title, subtitle }: Props) {
  return (
    <header className="border-b border-zinc-200 pb-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">{badge}</p>
      <h1 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">{title}</h1>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">{subtitle}</p>
    </header>
  );
}
