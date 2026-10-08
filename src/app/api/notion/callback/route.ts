import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/notion";

// Notion redirects here after the user approves access.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/?${q}`, url.origin));

  const error = url.searchParams.get("error");
  if (error) return back(`notionError=${encodeURIComponent(error)}`);

  const state = url.searchParams.get("state");
  const expected = (await cookies()).get("notion_oauth_state")?.value;
  if (!state || state !== expected) return back("notionError=state_mismatch");

  const code = url.searchParams.get("code");
  if (!code) return back("notionError=no_code");

  try {
    await exchangeCode(code);
  } catch (e) {
    return back(`notionError=${encodeURIComponent((e instanceof Error ? e.message : String(e)).slice(0, 300))}`);
  }
  const res = back("notion=connected");
  res.cookies.delete("notion_oauth_state");
  return res;
}
