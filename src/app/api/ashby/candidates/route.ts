import { NextResponse } from "next/server";
import { searchCandidates } from "@/lib/ashby";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ candidates: await searchCandidates(q), sample: !process.env.ASHBY_API_KEY });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
