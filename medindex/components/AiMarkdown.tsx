import type { ReactNode } from "react";

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
    blocks.push(
      <p key={`p-${blockKey++}`}>{parseInline(trimmed, `p-${blockKey}`)}</p>,
    );
  }
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}
