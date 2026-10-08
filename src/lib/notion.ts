// Writes a new offer to the Notion "Offers" database. Property names must
// match the database exactly (see README). Does nothing until Notion is
// connected, either with NOTION_TOKEN or through the OAuth "Connect Notion" step.
import { promises as fs } from "node:fs";
import path from "node:path";
import { derive, type Offer } from "./offer";

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
    "RSU total": num(offer.rsu_total),
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

// Calls the Notion API with whichever credential is set up. OAuth tokens that
// carry a refresh token can expire; refresh once and retry.
async function notionFetch(call: (token: string) => Promise<Response>): Promise<Response | null> {
  const oauth = process.env.NOTION_TOKEN ? null : await readOAuth();
  const token = process.env.NOTION_TOKEN || oauth?.access_token;
  if (!token) return null;
  let res = await call(token);
  if (res.status === 401 && oauth?.refresh_token && oauthConfigured()) {
    const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: oauth.refresh_token });
    res = await call(fresh.access_token);
  }
  return res;
}

export async function notionConnected() {
  return Boolean(process.env.NOTION_OFFERS_DATABASE_ID && (process.env.NOTION_TOKEN || (await readOAuth())));
}

export async function createNotionOffer(offer: Offer): Promise<string | null> {
  const databaseId = process.env.NOTION_OFFERS_DATABASE_ID;
  if (!databaseId) return null;
  const res = await notionFetch((token) => createPage(token, databaseId, offer));
  if (!res) return null;
  if (res.status === 404) {
    throw new Error("Notion can't see the Offers database. Reconnect Notion and select the \"Offer to Contract MVP\" page.");
  }
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  const page = (await res.json()) as { url: string };
  return page.url;
}

// ---- Reading offers back -------------------------------------------------

// Notion returns each property as a typed object; these pull out the value.
type Prop = {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  date?: { start: string } | null;
  number?: number | null;
  email?: string | null;
};
type NotionPage = { id: string; url: string; created_time: string; properties: Record<string, Prop> };

const plain = (p?: Prop) => (p?.title ?? p?.rich_text ?? []).map((t) => t.plain_text).join("");
const sel = (p?: Prop) => p?.select?.name ?? "";
const day = (p?: Prop) => p?.date?.start?.slice(0, 10) ?? "";
const number = (p?: Prop) => (typeof p?.number === "number" ? p.number : null);

export const pageIdFromUrl = (url: string | null) => url?.replace(/-/g, "").match(/[0-9a-f]{32}/i)?.[0] ?? null;

export function offerFromNotion(page: NotionPage): Omit<Offer, "id" | "candidate_details"> & { notion_page_id: string } {
  const p = page.properties;
  const base = {
    ashby_candidate_id: plain(p["Ashby candidate ID"]),
    candidate_name: plain(p["Candidate"]),
    personal_email: p["Candidate email"]?.email ?? "",
    job_title_contract: plain(p["Job title (contract)"]),
    manager: plain(p["Manager"]),
    work_location: sel(p["Work location"]) as Offer["work_location"],
    legal_entity: (sel(p["Legal entity"]) || "Prior Labs GmbH") as Offer["legal_entity"],
    contract_type: (sel(p["Contract type"]) || "Indefinite") as Offer["contract_type"],
    start_date: day(p["Start date"]),
    end_date: day(p["End date"]),
    hours_per_week: number(p["Hours per week"]) ?? 40,
    base_salary_annual: number(p["Base salary (annual)"]) ?? 0,
    rsu_total: number(p["RSU total"]) ?? 0,
    relocation_amount: number(p["Relocation"]),
    rationale: plain(p["Rationale"]),
    candidate_expectation: plain(p["Candidate expectation"]),
  };
  return {
    ...base,
    // Always recomputed from the current base and RSU, so edits in Notion carry through.
    ...derive(base),
    status: (sel(p["Status"]) || "Pending approval") as Offer["status"],
    created_at: page.created_time,
    notion_url: page.url,
    notion_page_id: page.id.replace(/-/g, ""),
  };
}

export async function queryNotionOffers() {
  const databaseId = process.env.NOTION_OFFERS_DATABASE_ID;
  if (!databaseId) return null;
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await notionFetch((token) =>
      fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
        body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
        cache: "no-store",
      }),
    );
    if (!res) return null;
    if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { results: NotionPage[]; has_more: boolean; next_cursor: string | null };
    pages.push(...json.results);
    cursor = json.has_more ? (json.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages.map(offerFromNotion);
}

// ---- Templates database --------------------------------------------------

export interface NotionTemplate {
  page_id: string;
  kind: "offer_letter" | "contract";
  legal_entity: string;
  contract_type: string;
  link: string | null;
  md_signatory: string;
  md_signatory_email: string;
}

const KIND_LABEL = { offer_letter: "Offer letter", contract: "Contract" } as const;

type TemplatePage = { id: string; properties: Record<string, Prop & { url?: string | null }> };

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" };
}

export async function queryNotionTemplates(): Promise<NotionTemplate[] | null> {
  const databaseId = process.env.NOTION_TEMPLATES_DATABASE_ID;
  if (!databaseId) return null;
  const res = await notionFetch((token) =>
    fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ page_size: 100 }),
      cache: "no-store",
    }),
  );
  if (!res) return null;
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  const { results } = (await res.json()) as { results: TemplatePage[] };
  return results.flatMap((page) => {
    const p = page.properties;
    const kind = sel(p["Kind"]) === "Contract" ? "contract" : sel(p["Kind"]) === "Offer letter" ? "offer_letter" : null;
    if (!kind) return [];
    return [{
      page_id: page.id,
      kind,
      legal_entity: sel(p["Legal entity"]),
      contract_type: sel(p["Contract type"]),
      link: p["Template link"]?.url ?? null,
      md_signatory: plain(p["MD signatory"]),
      md_signatory_email: p["MD signatory email"]?.email ?? "",
    }];
  });
}

// Creates or updates the one Templates row for this document, entity and contract type.
export async function upsertNotionTemplate(t: Omit<NotionTemplate, "page_id">, label: string): Promise<boolean> {
  const databaseId = process.env.NOTION_TEMPLATES_DATABASE_ID;
  if (!databaseId || !(await notionConnected())) return false;
  const existing = (await queryNotionTemplates())?.find(
    (r) => r.kind === t.kind && r.legal_entity === t.legal_entity && r.contract_type === t.contract_type,
  );
  const properties = {
    Name: { title: [{ text: { content: label } }] },
    Kind: { select: { name: KIND_LABEL[t.kind] } },
    "Legal entity": { select: { name: t.legal_entity } },
    "Contract type": { select: { name: t.contract_type } },
    "Template link": { url: t.link || null },
    "MD signatory": text(t.md_signatory),
    "MD signatory email": { email: t.md_signatory_email || null },
    Active: { checkbox: Boolean(t.link) },
  };
  const res = await notionFetch((token) =>
    existing
      ? fetch(`https://api.notion.com/v1/pages/${existing.page_id}`, {
          method: "PATCH",
          headers: headers(token),
          body: JSON.stringify({ properties }),
        })
      : fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: headers(token),
          body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
        }),
  );
  if (!res) return false;
  if (res.status === 404) throw new Error("Notion can't see the Templates database. Reconnect Notion and select the \"Offer to Contract MVP\" page.");
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return true;
}
