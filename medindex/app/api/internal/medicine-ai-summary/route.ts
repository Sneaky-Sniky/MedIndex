import { NextResponse } from "next/server";
import { z } from "zod";
import { runMedicineSummaryJob } from "@/lib/ai/run-medicine-summary";

export const maxDuration = 300;

const bodySchema = z.object({
  medicineCim: z.string().min(1),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return unauthorized();
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await runMedicineSummaryJob(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Job failed";
    console.error("medicine-ai-summary:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
