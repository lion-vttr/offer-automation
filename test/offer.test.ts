import { describe, expect, it } from "vitest";
import { derive, isWorkingDay, validate, type OfferInput } from "@/lib/offer";

const base: OfferInput = {
  ashby_candidate_id: "c1",
  candidate_name: "Alex Example",
  personal_email: "alex@example.com",
  job_title_contract: "Research Scientist",
  manager: "Riley Manager",
  work_location: "Berlin",
  legal_entity: "Prior Labs GmbH",
  contract_type: "Indefinite",
  start_date: "2026-11-02", // Monday
  end_date: "",
  hours_per_week: 40,
  base_salary_annual: 100000,
  rsu_total: 240000,
  relocation_amount: null,
  rationale: "In band",
  candidate_expectation: "",
};

describe("derive", () => {
  it("computes monthly gross, RSU per year and total comp", () => {
    expect(derive(base)).toEqual({
      currency: "EUR",
      base_salary_monthly_gross: 8333.33,
      rsu_annual: 80000,
      total_comp_annual: 180000,
    });
  });
  it("uses USD for Deel PEO", () => {
    expect(derive({ ...base, legal_entity: "Deel PEO (US)" }).currency).toBe("USD");
  });
});

describe("isWorkingDay", () => {
  it("rejects weekends", () => {
    expect(isWorkingDay("2026-11-15", "Prior Labs GmbH")).toBe(false); // Sunday
    expect(isWorkingDay("2026-11-16", "Prior Labs GmbH")).toBe(true);
  });
  it("rejects German holidays for the GmbH only", () => {
    expect(isWorkingDay("2026-10-05", "Prior Labs GmbH")).toBe(true);
    expect(isWorkingDay("2027-03-29", "Prior Labs GmbH")).toBe(false); // Easter Monday 2027
    expect(isWorkingDay("2027-03-29", "Deel PEO (US)")).toBe(true);
  });
});

describe("validate", () => {
  it("accepts a complete offer", () => {
    expect(validate(base)).toEqual({});
  });
  it("requires an end date after the start for fixed-term", () => {
    expect(validate({ ...base, contract_type: "Fixed-term" }).end_date).toBeDefined();
    expect(validate({ ...base, contract_type: "Fixed-term", end_date: "2026-10-01" }).end_date).toBeDefined();
    expect(validate({ ...base, contract_type: "Fixed-term", end_date: "2027-10-31" }).end_date).toBeUndefined();
  });
  it("flags a weekend start date and missing rationale", () => {
    const errors = validate({ ...base, start_date: "2026-11-15", rationale: " " });
    expect(errors.start_date).toBeDefined();
    expect(errors.rationale).toBeDefined();
  });
});
