import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeUrl, oauthConfigured } from "@/lib/notion";

// Starts the Notion OAuth flow. The state cookie is checked in the callback.
export async function GET() {
  if (!oauthConfigured()) {
    return NextResponse.json({ error: "Set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET in .env.local, then restart the app." }, { status: 400 });
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("notion_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
