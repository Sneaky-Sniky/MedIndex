import { createElement, type ReactNode } from "react";

const HEADING_CLASS: Record<number, string> = {
  1: "text-base font-semibold text-zinc-950",
  2: "text-sm font-semibold text-zinc-950",
  3: "text-sm font-medium text-zinc-900",
  4: "text-sm font-medium text-zinc-800",
  5: "text-xs font-medium text-zinc-800",
  6: "text-xs font-medium text-zinc-700",
};

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(part);
    if (m) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-medium text-zinc-900">
          {m[1]}
        </strong>
      );
    }
    return part ? <span key={`${keyPrefix}-t-${i}`}>{part}</span> : null;
  });
}

export function AiMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blockKey++}`} className="list-disc space-y-1 pl-5">
        {listItems}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const bullet = /^[-*]\s+(.+)$/.exec(line.trim());
    if (bullet) {
      listItems.push(
        <li key={`li-${listItems.length}`}>
          {parseInline(bullet[1]!, `li-${listItems.length}`)}
        </li>,
      );
      continue;
    }
    flushList();
    const trimmed = line.trim();
    if (!trimmed) continue;
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1]!.length;
      const key = `h-${blockKey++}`;
      blocks.push(
        createElement(
          `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
          {
            key,
            className: HEADING_CLASS[level] ?? HEADING_CLASS[3],
          },
          parseInline(heading[2]!, key),
        ),
      );
      continue;
    }
    blocks.push(
      <p key={`p-${blockKey++}`}>{parseInline(trimmed, `p-${blockKey}`)}</p>,
    );
  }
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}
