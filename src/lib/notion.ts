// Writes a new offer to the Notion "Offers" database. Property names must
// match the database exactly (see README). Does nothing until Notion is
// connected, either with NOTION_TOKEN or through the OAuth "Connect Notion" step.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Offer } from "./offer";

const NOTION_VERSION = "2022-06-28";
const OAUTH_FILE = path.join(process.cwd(), ".data", "notion-oauth.json");

// ---- OAuth ---------------------------------------------------------------

export interface NotionOAuth {
  access_token: string;
  refresh_token?: string;
  workspace_name?: string;
  connected_at: string;
}

export const redirectUri = () => process.env.NOTION_REDIRECT_URI || "http://localhost:3000/api/notion/callback";

export function oauthConfigured() {
  return Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);
}

export function authorizeUrl(state: string) {
  const u = new URL("https://api.notion.com/v1/oauth/authorize");
  u.searchParams.set("client_id", process.env.NOTION_CLIENT_ID ?? "");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("owner", "user");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenRequest(body: Record<string, string>): Promise<NotionOAuth> {
  const basic = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion OAuth ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; workspace_name?: string };
  const saved: NotionOAuth = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    workspace_name: json.workspace_name,
    connected_at: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(OAUTH_FILE), { recursive: true });
  await fs.writeFile(OAUTH_FILE, JSON.stringify(saved, null, 2), { mode: 0o600 });
  return saved;
}

export const exchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });

export async function readOAuth(): Promise<NotionOAuth | null> {
  try {
    return JSON.parse(await fs.readFile(OAUTH_FILE, "utf8")) as NotionOAuth;
  } catch {
    return null;
  }
}

export async function disconnect() {
  await fs.rm(OAUTH_FILE, { force: true });
}

// ---- Offers ----------------------------------------------------------------

const text = (value: string) => ({ rich_text: value ? [{ text: { content: value.slice(0, 2000) } }] : [] });
const select = (name: string) => ({ select: name ? { name } : null });
const date = (start: string) => ({ date: start ? { start } : null });
const num = (n: number | null) => ({ number: n });

export function notionProperties(offer: Offer) {
  return {
    Candidate: { title: [{ text: { content: offer.candidate_name } }] },
    Status: select(offer.status),
    "Candidate email": { email: offer.personal_email || null },
    "Ashby candidate ID": text(offer.ashby_candidate_id),
    "Job title (contract)": text(offer.job_title_contract),
    Manager: text(offer.manager),
    "Work location": select(offer.work_location),
    "Legal entity": select(offer.legal_entity),
    "Contract type": select(offer.contract_type),
    "Start date": date(offer.start_date),
    "End date": date(offer.contract_type === "Fixed-term" ? offer.end_date : ""),
    "Hours per week": num(offer.hours_per_week),
    Currency: select(offer.currency),
    "Base salary (annual)": num(offer.base_salary_annual),
    "Monthly gross": num(offer.base_salary_monthly_gross),
    "RSU total": num(offer.rsu_total),
    "RSU per year": num(offer.rsu_annual),
    "Total comp (annual)": num(offer.total_comp_annual),
    Relocation: num(offer.relocation_amount),
    Rationale: text(offer.rationale),
    "Candidate expectation": text(offer.candidate_expectation),
  };
}

async function createPage(token: string, databaseId: string, offer: Offer) {
  return fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: databaseId }, properties: notionProperties(offer) }),
  });
}

export async function createNotionOffer(offer: Offer): Promise<string | null> {
  const databaseId = process.env.NOTION_OFFERS_DATABASE_ID;
  const oauth = process.env.NOTION_TOKEN ? null : await readOAuth();
  const token = process.env.NOTION_TOKEN || oauth?.access_token;
  if (!token || !databaseId) return null;

  let res = await createPage(token, databaseId, offer);
  // OAuth tokens that carry a refresh token can expire; refresh once and retry.
  if (res.status === 401 && oauth?.refresh_token && oauthConfigured()) {
    const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: oauth.refresh_token });
    res = await createPage(fresh.access_token, databaseId, offer);
  }
  if (res.status === 404) {
    throw new Error("Notion can't see the Offers database. Reconnect Notion and select the \"Offer to Contract MVP\" page.");
  }
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  const page = (await res.json()) as { url: string };
  return page.url;
}
