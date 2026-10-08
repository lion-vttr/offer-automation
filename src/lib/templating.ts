// Fills an uploaded .docx template with {{field}} placeholders. Missing values
// are left visible as [[MISSING: field]] so nothing goes out silently blank.
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { formatAmount, formatDate, type Offer } from "./offer";

// Every placeholder a template may use. Shown on the Templates page so Legal
// can prepare templates with one token style.
export const TOKENS: { token: string; description: string }[] = [
  { token: "candidate_name", description: "Preferred name from Ashby" },
  { token: "first_name", description: "First word of the preferred name (\"Dear …\")" },
  { token: "personal_email", description: "Candidate email" },
  { token: "job_title_contract", description: "Job title as it appears in the contract" },
  { token: "manager", description: "Reports to" },
  { token: "work_location", description: "Berlin, Freiburg im Breisgau, New York, remote" },
  { token: "legal_entity", description: "Prior Labs GmbH or Deel PEO (US)" },
  { token: "contract_type", description: "Indefinite or Fixed-term" },
  { token: "start_date", description: "e.g. 2 November 2026" },
  { token: "end_date", description: "Fixed-term only" },
  { token: "hours_per_week", description: "Default 40" },
  { token: "currency", description: "EUR or USD" },
  { token: "base_salary_annual", description: "e.g. EUR 100.000,00 or USD 120,000.00" },
  { token: "base_salary_monthly_gross", description: "Annual ÷ 12, for DE contracts" },
  { token: "rsu_total", description: "RSU value over 3 years" },
  { token: "rsu_annual", description: "RSU per year" },
  { token: "relocation_amount", description: "Empty when there is no relocation" },
  { token: "legal_first_name", description: "From the acceptance reply" },
  { token: "legal_last_name", description: "From the acceptance reply" },
  { token: "legal_full_name", description: "First + last legal name" },
  { token: "address_street", description: "From the acceptance reply" },
  { token: "address_number", description: "From the acceptance reply" },
  { token: "postcode", description: "From the acceptance reply" },
  { token: "city", description: "From the acceptance reply" },
  { token: "country", description: "From the acceptance reply" },
  { token: "date_of_birth", description: "From the acceptance reply" },
  { token: "nationality", description: "From the acceptance reply" },
  { token: "md_signatory", description: "Set per template on the Templates page" },
  { token: "today", description: "Date the document was generated" },
];

export function tokenValues(offer: Offer, mdSignatory: string): Record<string, string> {
  const d = offer.candidate_details;
  const money = (n: number) => formatAmount(n, offer.currency);
  const startDate = d?.confirmed_start_date || offer.start_date;
  return {
    candidate_name: offer.candidate_name,
    first_name: offer.candidate_name.split(/\s+/)[0] ?? "",
    personal_email: offer.personal_email,
    job_title_contract: offer.job_title_contract,
    manager: offer.manager,
    work_location: offer.work_location,
    legal_entity: offer.legal_entity,
    contract_type: offer.contract_type,
    start_date: formatDate(startDate),
    end_date: offer.contract_type === "Fixed-term" ? formatDate(offer.end_date) : "",
    hours_per_week: String(offer.hours_per_week),
    currency: offer.currency,
    base_salary_annual: money(offer.base_salary_annual),
    base_salary_monthly_gross: money(offer.base_salary_monthly_gross),
    rsu_total: money(offer.rsu_total),
    rsu_annual: money(offer.rsu_annual),
    relocation_amount: offer.relocation_amount ? money(offer.relocation_amount) : "",
    legal_first_name: d?.legal_first_name ?? "",
    legal_last_name: d?.legal_last_name ?? "",
    legal_full_name: d ? `${d.legal_first_name} ${d.legal_last_name}`.trim() : "",
    address_street: d?.address_street ?? "",
    address_number: d?.address_number ?? "",
    postcode: d?.postcode ?? "",
    city: d?.city ?? "",
    country: d?.country ?? "",
    date_of_birth: d?.date_of_birth ? formatDate(d.date_of_birth) : "",
    nationality: d?.nationality ?? "",
    md_signatory: mdSignatory,
    today: formatDate(new Date().toISOString().slice(0, 10)),
  };
}

// Tokens that are allowed to be empty without being flagged.
const OPTIONAL = new Set(["end_date", "relocation_amount"]);

export function fillDocx(template: Buffer, values: Record<string, string>): { doc: Buffer; missing: string[] } {
  const missing = new Set<string>();
  const doc = new Docxtemplater(new PizZip(template), {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter(part) {
      const name = part.value?.trim() ?? "?";
      missing.add(name);
      return `[[MISSING: ${name}]]`;
    },
  });
  const data: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(values)) data[k] = v || (OPTIONAL.has(k) ? "" : undefined);
  doc.render(data);
  return { doc: doc.getZip().generate({ type: "nodebuffer" }) as Buffer, missing: [...missing] };
}
