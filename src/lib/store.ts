// Local persistence for offers and templates. Offers are always kept in
// .data/offers.json so the app works without Notion; when NOTION_TOKEN is set
// each new offer is also written to the Notion Offers database.
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { derive, type CandidateDetails, type Offer, type OfferInput } from "./offer";
import {
  createNotionOffer,
  notionConnected,
  pageIdFromUrl,
  queryNotionOffers,
  queryNotionTemplates,
  upsertNotionTemplate,
} from "./notion";

const DATA_DIR = path.join(process.cwd(), ".data");
const OFFERS_FILE = path.join(DATA_DIR, "offers.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

const newestFirst = (a: Offer, b: Offer) => b.created_at.localeCompare(a.created_at);

// When Notion is connected it is the source of truth: every row in the Offers
// database is shown with its current values. The local file only adds what
// Notion doesn't hold here (candidate details) and offers never sent to Notion.
export async function loadOffers(): Promise<{ offers: Offer[]; notionError: string | null }> {
  const local = await readJson<Offer[]>(OFFERS_FILE, []);
  if (!(await notionConnected())) return { offers: local.sort(newestFirst), notionError: null };

  let rows;
  try {
    rows = await queryNotionOffers();
  } catch (e) {
    return { offers: local.sort(newestFirst), notionError: e instanceof Error ? e.message : String(e) };
  }
  if (!rows) return { offers: local.sort(newestFirst), notionError: null };

  const byPage = new Map(local.map((o) => [pageIdFromUrl(o.notion_url), o]));
  const merged: Offer[] = rows.map(({ notion_page_id, ...row }) => {
    const mine = byPage.get(notion_page_id);
    return { ...row, id: mine?.id ?? notion_page_id, candidate_details: mine?.candidate_details ?? null };
  });
  const unsynced = local.filter((o) => !o.notion_url);
  return { offers: [...merged, ...unsynced].sort(newestFirst), notionError: null };
}

export async function listOffers(): Promise<Offer[]> {
  return (await loadOffers()).offers;
}

export async function getOffer(id: string): Promise<Offer | undefined> {
  return (await listOffers()).find((o) => o.id === id);
}

export async function createOffer(input: OfferInput): Promise<{ offer: Offer; notionError: string | null }> {
  const offer: Offer = {
    ...input,
    ...derive(input),
    id: randomUUID(),
    status: "Pending approval",
    created_at: new Date().toISOString(),
    notion_url: null,
    candidate_details: null,
  };
  let notionError: string | null = null;
  try {
    offer.notion_url = await createNotionOffer(offer);
  } catch (e) {
    notionError = e instanceof Error ? e.message : String(e);
  }
  const offers = await readJson<Offer[]>(OFFERS_FILE, []);
  offers.push(offer);
  await writeJson(OFFERS_FILE, offers);
  return { offer, notionError };
}

export async function saveCandidateDetails(id: string, details: CandidateDetails) {
  const offers = await readJson<Offer[]>(OFFERS_FILE, []);
  let offer = offers.find((o) => o.id === id);
  if (!offer) {
    // A row created directly in Notion: keep a local copy to hold the details.
    const fromNotion = await getOffer(id);
    if (!fromNotion) throw new Error("Offer not found");
    offer = { ...fromNotion };
    offers.push(offer);
  }
  offer.candidate_details = details;
  await writeJson(OFFERS_FILE, offers);
}

// ---- Templates ---------------------------------------------------------

export const TEMPLATE_DIR = path.join(process.cwd(), "templates");
const TEMPLATES_FILE = path.join(DATA_DIR, "templates.json");

export type TemplateKind = "offer_letter" | "contract";

export interface TemplateSlot {
  key: string;
  kind: TemplateKind;
  legal_entity: Offer["legal_entity"];
  contract_type: Offer["contract_type"];
  label: string;
}

export interface TemplateEntry {
  key: string;
  filename: string | null; // uploaded .docx stored in templates/
  link: string | null; // Google Docs / Drive link, for the Claude routines
  md_signatory: string;
  md_signatory_email: string;
  updated_at: string;
}

// One slot per entity × contract type × document, as in the template matrix.
export const TEMPLATE_SLOTS: TemplateSlot[] = (["offer_letter", "contract"] as const).flatMap((kind) =>
  (["Prior Labs GmbH", "Deel PEO (US)"] as const).flatMap((legal_entity) =>
    (["Indefinite", "Fixed-term"] as const).map((contract_type) => ({
      key: `${kind}__${legal_entity}__${contract_type}`.replace(/[^a-zA-Z0-9_-]+/g, "-"),
      kind,
      legal_entity,
      contract_type,
      label: `${kind === "offer_letter" ? "Offer letter" : "Contract"} · ${legal_entity} · ${contract_type}`,
    })),
  ),
);

const readLocalTemplates = () => readJson<Record<string, TemplateEntry>>(TEMPLATES_FILE, {});

// The uploaded .docx lives on this computer. The link and MD signatory live in
// the Notion Templates database when Notion is connected, so edits there win.
export async function loadTemplates(): Promise<{ templates: Record<string, TemplateEntry>; notionError: string | null }> {
  const local = await readLocalTemplates();
  let rows;
  try {
    rows = await queryNotionTemplates();
  } catch (e) {
    return { templates: local, notionError: e instanceof Error ? e.message : String(e) };
  }
  if (!rows || !(await notionConnected())) return { templates: local, notionError: null };

  const merged: Record<string, TemplateEntry> = {};
  for (const slot of TEMPLATE_SLOTS) {
    const mine = local[slot.key];
    const row = rows.find((r) => r.kind === slot.kind && r.legal_entity === slot.legal_entity && r.contract_type === slot.contract_type);
    if (!mine && !row) continue;
    merged[slot.key] = {
      key: slot.key,
      filename: mine?.filename ?? null,
      link: row ? row.link : (mine?.link ?? null),
      md_signatory: row ? row.md_signatory : (mine?.md_signatory ?? ""),
      md_signatory_email: row ? row.md_signatory_email : (mine?.md_signatory_email ?? ""),
      updated_at: mine?.updated_at ?? "",
    };
  }
  return { templates: merged, notionError: null };
}

export async function listTemplates(): Promise<Record<string, TemplateEntry>> {
  return (await loadTemplates()).templates;
}

// Saves locally, then writes the link and signatory to the Notion Templates row.
// Returns false when Notion isn't connected.
export async function saveTemplate(entry: TemplateEntry): Promise<boolean> {
  const all = await readLocalTemplates();
  all[entry.key] = entry;
  await writeJson(TEMPLATES_FILE, all);
  const slot = TEMPLATE_SLOTS.find((s) => s.key === entry.key)!;
  return upsertNotionTemplate(
    {
      kind: slot.kind,
      legal_entity: slot.legal_entity,
      contract_type: slot.contract_type,
      link: entry.link,
      md_signatory: entry.md_signatory,
      md_signatory_email: entry.md_signatory_email,
    },
    slot.label,
  );
}

export async function removeTemplateFile(key: string) {
  const all = await readLocalTemplates();
  const entry = all[key];
  if (!entry) return;
  if (entry.filename) await fs.rm(path.join(TEMPLATE_DIR, entry.filename), { force: true });
  entry.filename = null;
  entry.updated_at = new Date().toISOString();
  await writeJson(TEMPLATES_FILE, all);
}

export function slotFor(kind: TemplateKind, offer: Pick<Offer, "legal_entity" | "contract_type">) {
  return TEMPLATE_SLOTS.find(
    (s) => s.kind === kind && s.legal_entity === offer.legal_entity && s.contract_type === offer.contract_type,
  )!;
}
