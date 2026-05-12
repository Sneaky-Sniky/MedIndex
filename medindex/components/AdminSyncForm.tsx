"use client";

import { useState } from "react";
import { adminRunAnmSync } from "@/actions/community";

export function AdminSyncForm() {
  const [log, setLog] = useState<string>("");

  return (
    <div>
      <button
        type="button"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
        onClick={async () => {
          const r = await adminRunAnmSync();
          setLog(JSON.stringify(r, null, 2));
        }}
      >
        Run ANM sync
      </button>
      {log ? (
        <pre className="mt-4 max-h-64 overflow-auto rounded bg-zinc-100 p-3 text-xs">
          {log}
        </pre>
      ) : null}
    </div>
  );
}
