// Writes a new offer to the Notion "Offers" database. Property names must
// match the database exactly (see README). Does nothing without NOTION_TOKEN.
import type { Offer } from "./offer";

const NOTION_VERSION = "2022-06-28";

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

export async function createNotionOffer(offer: Offer): Promise<string | null> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_OFFERS_DATABASE_ID;
  if (!token || !databaseId) return null;

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: databaseId }, properties: notionProperties(offer) }),
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  const page = (await res.json()) as { url: string };
  return page.url;
}
