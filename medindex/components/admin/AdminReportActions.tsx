"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateErrorReportStatus } from "@/actions/admin";
import { AiMarkdown } from "@/components/AiMarkdown";
import { Spinner } from "@/components/Spinner";
import {
  ERROR_REPORT_STATUSES,
  type ErrorReportStatus,
} from "@/lib/admin/reports";
import { formatForumDate } from "@/lib/forum/format";

export function AdminReportActions({
  reportId,
  initialStatus,
  initialValidation,
  initialValidatedAt,
  locale,
  slug,
}: {
  reportId: string;
  initialStatus: ErrorReportStatus;
  initialValidation: string | null;
  initialValidatedAt: string | null;
  locale: "ro" | "hu";
  slug?: string;
}) {
  const t = useTranslations("admin");
  const tAi = useTranslations("ai");
  const [status, setStatus] = useState(initialStatus);
  const [validation, setValidation] = useState(initialValidation);
  const [validatedAt, setValidatedAt] = useState(initialValidatedAt);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runValidation() {
    setValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/validate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, locale }),
      });
      const data = (await res.json()) as {
        validation?: string;
        validatedAt?: string;
        status?: ErrorReportStatus;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? tAi("requestFailed"));
        return;
      }
      if (data.validation) setValidation(data.validation);
      if (data.validatedAt) setValidatedAt(data.validatedAt);
      if (data.status) setStatus(data.status);
    } catch {
      setError(tAi("requestFailed"));
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={updateErrorReportStatus} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={reportId} />
          <input type="hidden" name="locale" value={locale} />
          {slug ? <input type="hidden" name="slug" value={slug} /> : null}
          <label htmlFor={`status-${reportId}`} className="sr-only">
            {t("reportStatus")}
          </label>
          <select
            id={`status-${reportId}`}
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ErrorReportStatus)}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm"
          >
            {ERROR_REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            {t("saveStatus")}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void runValidation()}
          disabled={validating}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {validating ? <Spinner className="h-4 w-4" /> : null}
          {validating ? t("validating") : t("validateWithAi")}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      {validation ? (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-800">
              {t("aiAssessment")}
            </p>
            {validatedAt ? (
              <p className="text-xs text-violet-700/80">
                {formatForumDate(validatedAt, locale)}
              </p>
            ) : null}
          </div>
          <div className="mt-2 text-sm text-zinc-800">
            <AiMarkdown text={validation} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
