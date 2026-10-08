// Notion is the only store: offers, candidate details and templates (including
// the uploaded .docx files) all live in the "Offer to Contract MVP" databases.
// The app connects with OAuth ("Connect Notion") or an internal NOTION_TOKEN.
import { promises as fs } from "node:fs";
import path from "node:path";
import { derive, type CandidateDetails, type Offer } from "./offer";

const NOTION_VERSION = "2022-06-28";
const API = "https://api.notion.com/v1";
const OAUTH_FILE = path.join(process.cwd(), ".data", "notion-oauth.json");

const DB = {
  offers: () => process.env.NOTION_OFFERS_DATABASE_ID,
  details: () => process.env.NOTION_CANDIDATE_DETAILS_DATABASE_ID,
  templates: () => process.env.NOTION_TEMPLATES_DATABASE_ID,
};

export class NotionNotConnected extends Error {
  constructor() {
    super("Notion is not connected. Connect it on the Offers page.");
  }
}

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
  const u = new URL(`${API}/oauth/authorize`);
  u.searchParams.set("client_id", process.env.NOTION_CLIENT_ID ?? "");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("owner", "user");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenRequest(body: Record<string, string>): Promise<NotionOAuth> {
  const basic = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API}/oauth/token`, {
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

export async function notionConnected() {
  return Boolean(DB.offers() && (process.env.NOTION_TOKEN || (await readOAuth())));
}

// ---- Requests --------------------------------------------------------------

// Calls the Notion API with whichever credential is set up. OAuth tokens that
// carry a refresh token can expire; refresh once and retry.
async function call(pathname: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<Response> {
  const oauth = process.env.NOTION_TOKEN ? null : await readOAuth();
  let token = process.env.NOTION_TOKEN || oauth?.access_token;
  if (!token) throw new NotionNotConnected();

  const send = (t: string) =>
    fetch(pathname.startsWith("http") ? pathname : `${API}${pathname}`, {
      method: init.method ?? (init.body || init.form ? "POST" : "GET"),
      headers: {
        Authorization: `Bearer ${t}`,
        "Notion-Version": NOTION_VERSION,
        ...(init.form ? {} : { "Content-Type": "application/json" }),
      },
      body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
      cache: "no-store",
    });

  let res = await send(token);
  if (res.status === 401 && oauth?.refresh_token && oauthConfigured()) {
    token = (await tokenRequest({ grant_type: "refresh_token", refresh_token: oauth.refresh_token })).access_token;
    res = await send(token);
  }
  return res;
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (res.status === 404) {
    throw new Error(`Notion can't see the ${what}. Reconnect Notion and select the "Offer to Contract MVP" page.`);
  }
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function queryAll(databaseId: string, what: string, filter?: unknown): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await call(`/databases/${databaseId}/query`, {
      body: { page_size: 100, start_cursor: cursor, ...(filter ? { filter } : {}) },
    });
    const page = await json<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(res, what);
    pages.push(...page.results);
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

// ---- Property helpers ------------------------------------------------------

type Prop = {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  date?: { start: string } | null;
  number?: number | null;
  email?: string | null;
  url?: string | null;
  files?: { name: string; type: "file" | "external"; file?: { url: string }; external?: { url: string } }[];
  relation?: { id: string }[];
};
type NotionPage = { id: string; url: string; created_time: string; properties: Record<string, Prop> };

const plain = (p?: Prop) => (p?.title ?? p?.rich_text ?? []).map((t) => t.plain_text).join("");
const sel = (p?: Prop) => p?.select?.name ?? "";
const day = (p?: Prop) => p?.date?.start?.slice(0, 10) ?? "";
const number = (p?: Prop) => (typeof p?.number === "number" ? p.number : null);

const text = (value: string) => ({ rich_text: value ? [{ text: { content: value.slice(0, 2000) } }] : [] });
const title = (value: string) => ({ title: [{ text: { content: value || "–" } }] });
const select = (name: string) => ({ select: name ? { name } : null });
const date = (start: string) => ({ date: start ? { start } : null });
const num = (n: number | null) => ({ number: n });

const bare = (id: string) => id.replace(/-/g, "");

// ---- Offers ----------------------------------------------------------------

export function notionProperties(offer: Offer) {
  return {
    Candidate: title(offer.candidate_name),
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
    // Monthly gross, RSU per year and Total comp are Notion formulas.
  };
}

export function offerFromNotion(page: NotionPage): Offer {
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
    // Recomputed from the current base and RSU, so edits in Notion carry through.
    ...derive(base),
    id: bare(page.id),
    status: (sel(p["Status"]) || "Pending approval") as Offer["status"],
    created_at: page.created_time,
    notion_url: page.url,
    candidate_details: null,
  };
}

export async function createNotionOffer(offer: Omit<Offer, "id" | "notion_url" | "created_at" | "candidate_details">) {
  const databaseId = DB.offers();
  if (!databaseId) throw new NotionNotConnected();
  const res = await call("/pages", {
    body: { parent: { database_id: databaseId }, properties: notionProperties(offer as Offer) },
  });
  return offerFromNotion(await json<NotionPage>(res, "Offers database"));
}

export async function queryNotionOffers(): Promise<Offer[]> {
  const databaseId = DB.offers();
  if (!databaseId) throw new NotionNotConnected();
  return (await queryAll(databaseId, "Offers database")).map(offerFromNotion);
}

export async function getNotionOffer(id: string): Promise<Offer | null> {
  const res = await call(`/pages/${id}`);
  if (res.status === 404 || res.status === 400) return null;
  const page = await json<NotionPage & { archived?: boolean; in_trash?: boolean }>(res, "offer");
  if (page.archived || page.in_trash) return null;
  return offerFromNotion(page);
}

// ---- Candidate Details -----------------------------------------------------

function detailsFromNotion(page: NotionPage): CandidateDetails {
  const p = page.properties;
  return {
    legal_first_name: plain(p["Legal first name"]),
    legal_last_name: plain(p["Legal last name"]),
    address_street: plain(p["Street"]),
    address_number: plain(p["Number"]),
    postcode: plain(p["Postcode"]),
    city: plain(p["City"]),
    country: plain(p["Country"]),
    date_of_birth: day(p["Date of birth"]),
    nationality: plain(p["Nationality"]),
    right_to_work: sel(p["Right to work"]),
    confirmed_start_date: day(p["Confirmed start date"]),
  };
}

async function findDetailsPage(offerId: string): Promise<NotionPage | null> {
  const databaseId = DB.details();
  if (!databaseId) throw new Error("NOTION_CANDIDATE_DETAILS_DATABASE_ID is not set.");
  const rows = await queryAll(databaseId, "Candidate Details database", {
    property: "Offer",
    relation: { contains: offerId },
  });
  return rows[0] ?? null;
}

export async function getCandidateDetails(offerId: string): Promise<CandidateDetails | null> {
  const page = await findDetailsPage(offerId);
  return page ? detailsFromNotion(page) : null;
}

export async function saveCandidateDetails(offerId: string, d: CandidateDetails) {
  const databaseId = DB.details();
  if (!databaseId) throw new Error("NOTION_CANDIDATE_DETAILS_DATABASE_ID is not set.");
  const properties = {
    "Legal full name": title(`${d.legal_first_name} ${d.legal_last_name}`.trim()),
    Offer: { relation: [{ id: offerId }] },
    "Legal first name": text(d.legal_first_name),
    "Legal last name": text(d.legal_last_name),
    Street: text(d.address_street),
    Number: text(d.address_number),
    Postcode: text(d.postcode),
    City: text(d.city),
    Country: text(d.country),
    "Date of birth": date(d.date_of_birth),
    Nationality: text(d.nationality),
    "Right to work": select(d.right_to_work),
    "Confirmed start date": date(d.confirmed_start_date),
  };
  const existing = await findDetailsPage(offerId);
  const res = existing
    ? await call(`/pages/${existing.id}`, { method: "PATCH", body: { properties } })
    : await call("/pages", { body: { parent: { database_id: databaseId }, properties } });
  await json(res, "Candidate Details database");
}

// ---- Templates -------------------------------------------------------------

export interface NotionTemplate {
  page_id: string;
  kind: "offer_letter" | "contract";
  legal_entity: string;
  contract_type: string;
  link: string | null;
  file: { name: string; url: string } | null; // url is a signed link that expires after an hour
  md_signatory: string;
  md_signatory_email: string;
}

const KIND_LABEL = { offer_letter: "Offer letter", contract: "Contract" } as const;

function templateFromNotion(page: NotionPage): NotionTemplate | null {
  const p = page.properties;
  const kind = sel(p["Kind"]) === "Contract" ? "contract" : sel(p["Kind"]) === "Offer letter" ? "offer_letter" : null;
  if (!kind) return null;
  const f = p["File"]?.files?.[0];
  return {
    page_id: page.id,
    kind,
    legal_entity: sel(p["Legal entity"]),
    contract_type: sel(p["Contract type"]),
    link: p["Template link"]?.url ?? null,
    file: f ? { name: f.name, url: f.file?.url ?? f.external?.url ?? "" } : null,
    md_signatory: plain(p["MD signatory"]),
    md_signatory_email: p["MD signatory email"]?.email ?? "",
  };
}

export async function queryNotionTemplates(): Promise<NotionTemplate[]> {
  const databaseId = DB.templates();
  if (!databaseId) throw new Error("NOTION_TEMPLATES_DATABASE_ID is not set.");
  return (await queryAll(databaseId, "Templates database")).flatMap((p) => templateFromNotion(p) ?? []);
}

// Uploads a file to Notion (single part, up to 20 MB) and returns its upload id.
async function uploadFile(data: Buffer, filename: string, contentType: string): Promise<string> {
  const created = await json<{ id: string; upload_url: string }>(
    await call("/file_uploads", { body: { mode: "single_part", filename, content_type: contentType } }),
    "file upload",
  );
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: contentType }), filename);
  await json(await call(created.upload_url || `/file_uploads/${created.id}/send`, { form }), "file upload");
  return created.id;
}

export interface TemplateUpdate {
  kind: NotionTemplate["kind"];
  legal_entity: string;
  contract_type: string;
  label: string;
  link: string | null;
  md_signatory: string;
  md_signatory_email: string;
  file?: { data: Buffer; name: string } | null; // undefined: keep, null: remove
}

// Creates or updates the one Templates row for this document, entity and contract type.
export async function upsertNotionTemplate(t: TemplateUpdate) {
  const databaseId = DB.templates();
  if (!databaseId) throw new Error("NOTION_TEMPLATES_DATABASE_ID is not set.");
  const existing = (await queryNotionTemplates()).find(
    (r) => r.kind === t.kind && r.legal_entity === t.legal_entity && r.contract_type === t.contract_type,
  );

  const properties: Record<string, unknown> = {
    Name: title(t.label),
    Kind: select(KIND_LABEL[t.kind]),
    "Legal entity": select(t.legal_entity),
    "Contract type": select(t.contract_type),
    "Template link": { url: t.link || null },
    "MD signatory": text(t.md_signatory),
    "MD signatory email": { email: t.md_signatory_email || null },
  };
  let hasFile = Boolean(existing?.file);
  if (t.file === null) {
    properties.File = { files: [] };
    hasFile = false;
  } else if (t.file) {
    const id = await uploadFile(t.file.data, t.file.name, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    properties.File = { files: [{ type: "file_upload", file_upload: { id }, name: t.file.name }] };
    hasFile = true;
  }
  properties.Active = { checkbox: Boolean(t.link) || hasFile };

  const res = existing
    ? await call(`/pages/${existing.page_id}`, { method: "PATCH", body: { properties } })
    : await call("/pages", { body: { parent: { database_id: databaseId }, properties } });
  await json(res, "Templates database");
}

export async function downloadTemplateFile(file: NonNullable<NotionTemplate["file"]>): Promise<Buffer> {
  const res = await fetch(file.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not download the template from Notion (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
