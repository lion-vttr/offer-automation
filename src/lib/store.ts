// Offers, candidate details and templates, all stored in Notion (see notion.ts).
// Nothing is kept on this computer apart from the Notion connection itself.
import { derive, type CandidateDetails, type Offer, type OfferInput } from "./offer";
import {
  createNotionOffer,
  getCandidateDetails,
  getNotionOffer,
  queryNotionOffers,
  queryNotionTemplates,
  saveCandidateDetails as saveNotionDetails,
  upsertNotionTemplate,
  type NotionTemplate,
} from "./notion";

const newestFirst = (a: Offer, b: Offer) => b.created_at.localeCompare(a.created_at);

export async function listOffers(): Promise<Offer[]> {
  return (await queryNotionOffers()).sort(newestFirst);
}

export async function getOffer(id: string): Promise<Offer | null> {
  const offer = await getNotionOffer(id);
  if (!offer) return null;
  offer.candidate_details = await getCandidateDetails(offer.id);
  return offer;
}

export async function createOffer(input: OfferInput): Promise<Offer> {
  return createNotionOffer({ ...input, ...derive(input), status: "Pending approval" });
}

export async function saveCandidateDetails(id: string, details: CandidateDetails) {
  await saveNotionDetails(id, details);
}

// ---- Templates ---------------------------------------------------------

export type TemplateKind = "offer_letter" | "contract";

export interface TemplateSlot {
  key: string;
  kind: TemplateKind;
  legal_entity: Offer["legal_entity"];
  contract_type: Offer["contract_type"];
  label: string;
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

export function slotFor(kind: TemplateKind, offer: Pick<Offer, "legal_entity" | "contract_type">) {
  return TEMPLATE_SLOTS.find(
    (s) => s.kind === kind && s.legal_entity === offer.legal_entity && s.contract_type === offer.contract_type,
  )!;
}

// Templates keyed by slot key.
export async function listTemplates(): Promise<Record<string, NotionTemplate>> {
  const rows = await queryNotionTemplates();
  const out: Record<string, NotionTemplate> = {};
  for (const slot of TEMPLATE_SLOTS) {
    const row = rows.find((r) => r.kind === slot.kind && r.legal_entity === slot.legal_entity && r.contract_type === slot.contract_type);
    if (row) out[slot.key] = row;
  }
  return out;
}

export async function saveTemplate(
  key: string,
  values: { link: string | null; md_signatory: string; md_signatory_email: string; file?: { data: Buffer; name: string } | null },
) {
  const slot = TEMPLATE_SLOTS.find((s) => s.key === key);
  if (!slot) throw new Error("Unknown template slot");
  await upsertNotionTemplate({ ...slot, ...values });
}

export async function removeTemplateFile(key: string) {
  const slot = TEMPLATE_SLOTS.find((s) => s.key === key);
  const current = (await listTemplates())[key];
  if (!slot || !current) return;
  await upsertNotionTemplate({
    ...slot,
    link: current.link,
    md_signatory: current.md_signatory,
    md_signatory_email: current.md_signatory_email,
    file: null,
  });
}
