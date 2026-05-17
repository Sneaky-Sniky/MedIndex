import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";
import { completeChatWithTools } from "@/lib/ai/openai";
import {
  createMedicineToolRunner,
  formatFocusedMedicinesPrompt,
  MEDICINE_RAG_TOOLS,
} from "@/lib/ai/medicine-tools";
import { createLeafletVectorSession } from "@/lib/ai/leaflet-vector-store";
import { ragLog, ragLogTimed } from "@/lib/ai/rag-log";
import {
  buildValidateReportInput,
  validateReportFallback,
  validateReportInstructions,
  type ValidateReportLocale,
} from "@/lib/ai/validate-error-report-locale";

const FLOW = "validate-report";

export async function validateErrorReport(opts: {
  openai: OpenAI;
  supabase: SupabaseClient;
  message: string;
  medicineCim: string | null;
  locale: ValidateReportLocale;
}): Promise<string> {
  return ragLogTimed(
    FLOW,
    "validateErrorReport",
    async () => {
      let focusBlock: string | undefined;
      if (opts.medicineCim) {
        focusBlock = await formatFocusedMedicinesPrompt(opts.supabase, [
          opts.medicineCim,
        ]);
      }

      const input = buildValidateReportInput({
        locale: opts.locale,
        message: opts.message,
        medicineCim: opts.medicineCim,
        focusBlock: focusBlock || undefined,
      });

      ragLog(FLOW, "input", { medicineCim: opts.medicineCim, input });

      const leafletSession = createLeafletVectorSession();
      const runTool = createMedicineToolRunner(
        opts.openai,
        opts.supabase,
        leafletSession,
        FLOW,
        { allowOnDemandSync: false },
      );

      const answer =
        (await completeChatWithTools(opts.openai, {
          instructions: validateReportInstructions(opts.locale),
          input,
          tools: MEDICINE_RAG_TOOLS,
          runTool,
          leafletSession,
          maxOutputTokens: 1536,
          logFlow: FLOW,
        })) || validateReportFallback(opts.locale);

      return answer;
    },
    { medicineCim: opts.medicineCim, locale: opts.locale },
  );
}
