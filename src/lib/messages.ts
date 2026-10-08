// Text for the approval post (flow 2) and the offer email (flow 3). The
// routines in routines/ use the same wording.
import { formatDate, formatMoney, type Offer } from "./offer";

export function approvalMessage(offer: Offer): string {
  const m = (n: number) => formatMoney(n, offer.currency);
  const lines = [
    `*Offer for approval: ${offer.candidate_name}*`,
    `${offer.job_title_contract} · ${offer.work_location} · ${offer.legal_entity} · ${offer.contract_type}`,
    `Start ${formatDate(offer.start_date)}${offer.contract_type === "Fixed-term" ? `, ends ${formatDate(offer.end_date)}` : ""} · ${offer.hours_per_week} h/week`,
    "",
    `Base: ${m(offer.base_salary_annual)}${offer.legal_entity === "Prior Labs GmbH" ? ` (${m(offer.base_salary_monthly_gross)}/month)` : ""}`,
    `RSU: ${m(offer.rsu_total)} over 3 years (${m(offer.rsu_annual)}/year)`,
    offer.relocation_amount ? `Relocation: ${m(offer.relocation_amount)}` : null,
    `*Total comp: ${m(offer.total_comp_annual)}/year*`,
    "",
    `Rationale: ${offer.rationale}`,
    offer.candidate_expectation ? `Candidate expectation: ${offer.candidate_expectation}` : null,
    "",
    `Noah, Sauraj: please set your decision (Approve / Changes / Reject) and a comment on the Notion row${offer.notion_url ? `: ${offer.notion_url}` : "."}`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

export function rightToWorkCountry(offer: Offer): string {
  return offer.legal_entity === "Deel PEO (US)" ? "the United States" : "Germany";
}

export function offerEmailBody(offer: Offer): string {
  const first = offer.candidate_name.split(/\s+/)[0];
  return [
    `Dear ${first},`,
    "",
    `Following our conversation, I'm delighted to send you our offer for the role of ${offer.job_title_contract} at ${offer.legal_entity}. Your offer letter is attached.`,
    "",
    "Everything about the next steps, your RSUs and the bridge payment, benefits and who to contact is on our Information for Offer Holders page: [link]",
    "",
    "If you're happy to accept, please reply to this email to confirm, and include the following so we can prepare your contract:",
    "",
    "- Full legal name, as on your passport or ID",
    "- Home address (street and number, postcode, city, country)",
    "- Date of birth",
    "- Nationality",
    `- Whether you already have the right to work in ${rightToWorkCountry(offer)}, or will need visa sponsorship`,
    `- Confirmation of your start date: ${formatDate(offer.start_date)}`,
    "",
    "Your contract will then follow for signature through DocuSign.",
    "",
    "Best,",
    "Jerry",
  ].join("\n");
}
