// Offer model, derived numbers and validation for flow 1 (Propose).
// Field names follow the "MVP form fields" table on the flow page.

export const LEGAL_ENTITIES = ["Prior Labs GmbH", "Deel PEO (US)"] as const;
export const CONTRACT_TYPES = ["Indefinite", "Fixed-term"] as const;
export const WORK_LOCATIONS = ["Berlin", "Freiburg im Breisgau", "New York", "Remote"] as const;
export const STATUSES = [
  "Pending approval",
  "Changes requested",
  "Rejected",
  "Approved",
  "Sent",
  "Accepted",
  "Out for signature",
  "Declined",
] as const;

export type LegalEntity = (typeof LEGAL_ENTITIES)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type WorkLocation = (typeof WORK_LOCATIONS)[number];
export type OfferStatus = (typeof STATUSES)[number];

export const RSU_VESTING_YEARS = 3;
export const DEFAULT_HOURS = 40;

export interface OfferInput {
  ashby_candidate_id: string;
  candidate_name: string;
  personal_email: string;
  job_title_contract: string;
  manager: string;
  work_location: WorkLocation;
  legal_entity: LegalEntity;
  contract_type: ContractType;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD, fixed-term only
  hours_per_week: number;
  base_salary_annual: number;
  rsu_total: number;
  relocation_amount: number | null;
  rationale: string;
  candidate_expectation: string;
}

export interface CandidateDetails {
  legal_first_name: string;
  legal_last_name: string;
  address_street: string;
  address_number: string;
  postcode: string;
  city: string;
  country: string;
  date_of_birth: string;
  nationality: string;
  right_to_work: string;
  confirmed_start_date: string;
}

export interface Derived {
  currency: "EUR" | "USD";
  base_salary_monthly_gross: number;
  rsu_annual: number;
  total_comp_annual: number;
}

export interface Offer extends OfferInput, Derived {
  id: string;
  status: OfferStatus;
  created_at: string;
  notion_url: string | null;
  candidate_details: CandidateDetails | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function derive(input: Pick<OfferInput, "legal_entity" | "base_salary_annual" | "rsu_total">): Derived {
  const base = input.base_salary_annual || 0;
  const rsuAnnual = round2((input.rsu_total || 0) / RSU_VESTING_YEARS);
  return {
    currency: input.legal_entity === "Deel PEO (US)" ? "USD" : "EUR",
    base_salary_monthly_gross: round2(base / 12),
    rsu_annual: rsuAnnual,
    total_comp_annual: round2(base + rsuAnnual),
  };
}

// Easter Sunday (Anonymous Gregorian algorithm), used for German public holidays.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

// Nationwide German holidays plus those in Berlin (8 Mar) and Baden-Württemberg
// (6 Jan, Corpus Christi, 1 Nov), since we hire in Berlin and Freiburg.
export function germanHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  return new Set([
    `${year}-01-01`,
    `${year}-01-06`,
    `${year}-03-08`,
    iso(addDays(easter, -2)),
    iso(addDays(easter, 1)),
    `${year}-05-01`,
    iso(addDays(easter, 39)),
    iso(addDays(easter, 50)),
    iso(addDays(easter, 60)),
    `${year}-10-03`,
    `${year}-11-01`,
    `${year}-12-25`,
    `${year}-12-26`,
  ]);
}

export function isWorkingDay(dateStr: string, entity: LegalEntity): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (entity === "Prior Labs GmbH" && germanHolidays(d.getUTCFullYear()).has(dateStr)) return false;
  return true;
}

export type Errors = Partial<Record<keyof OfferInput, string>>;

export function validate(input: OfferInput): Errors {
  const errors: Errors = {};
  const required: (keyof OfferInput)[] = [
    "candidate_name",
    "personal_email",
    "job_title_contract",
    "manager",
    "work_location",
    "legal_entity",
    "contract_type",
    "start_date",
    "rationale",
  ];
  for (const key of required) {
    if (!String(input[key] ?? "").trim()) errors[key] = "Required";
  }
  if (input.personal_email && !/^\S+@\S+\.\S+$/.test(input.personal_email)) errors.personal_email = "Not an email address";
  if (!LEGAL_ENTITIES.includes(input.legal_entity)) errors.legal_entity = "Pick an entity";
  if (!CONTRACT_TYPES.includes(input.contract_type)) errors.contract_type = "Pick a contract type";
  if (!WORK_LOCATIONS.includes(input.work_location)) errors.work_location = "Pick a location";

  if (input.start_date && !errors.legal_entity && !isWorkingDay(input.start_date, input.legal_entity)) {
    errors.start_date = "Must be a working day (not a weekend or public holiday)";
  }
  if (input.contract_type === "Fixed-term") {
    if (!input.end_date) errors.end_date = "Required for fixed-term contracts";
    else if (input.start_date && input.end_date <= input.start_date) errors.end_date = "Must be after the start date";
  }
  if (!(input.hours_per_week > 0 && input.hours_per_week <= 48)) errors.hours_per_week = "Between 1 and 48";
  if (!(input.base_salary_annual > 0)) errors.base_salary_annual = "Enter the annual base salary";
  if (!(input.rsu_total >= 0)) errors.rsu_total = "Cannot be negative";
  if (input.relocation_amount != null && input.relocation_amount < 0) errors.relocation_amount = "Cannot be negative";
  return errors;
}

export function formatMoney(amount: number, currency: "EUR" | "USD"): string {
  return new Intl.NumberFormat(currency === "EUR" ? "de-DE" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Amount as written in the offer letter and contract: "EUR 8.333,33", "USD 120,000.00".
export function formatAmount(amount: number, currency: "EUR" | "USD"): string {
  const n = new Intl.NumberFormat(currency === "EUR" ? "de-DE" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${n}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}
