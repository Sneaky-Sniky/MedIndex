import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAnmIngest } from "@/lib/ingest/sync";

export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const qSecret = url.searchParams.get("secret");
  if (
    !secret ||
    (auth !== `Bearer ${secret}` && qSecret !== secret)
  ) {
    return unauthorized();
  }
  try {
    const admin = createAdminClient();
    const result = await runAnmIngest(admin);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
