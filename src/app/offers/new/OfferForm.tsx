"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOfferAction } from "@/app/actions";
import {
  CONTRACT_TYPES,
  DEFAULT_HOURS,
  LEGAL_ENTITIES,
  WORK_LOCATIONS,
  derive,
  formatMoney,
  isWorkingDay,
  type Errors,
  type OfferInput,
} from "@/lib/offer";
import type { AshbyCandidate } from "@/lib/ashby";

type FormState = Omit<OfferInput, "hours_per_week" | "base_salary_annual" | "rsu_total" | "relocation_amount"> & {
  hours_per_week: string;
  base_salary_annual: string;
  rsu_total: string;
  relocation_amount: string;
};

const EMPTY: FormState = {
  ashby_candidate_id: "",
  candidate_name: "",
  personal_email: "",
  job_title_contract: "",
  manager: "",
  work_location: "Berlin",
  legal_entity: "Prior Labs GmbH",
  contract_type: "Indefinite",
  start_date: "",
  end_date: "",
  hours_per_week: String(DEFAULT_HOURS),
  base_salary_annual: "",
  rsu_total: "",
  relocation_amount: "",
  rationale: "",
  candidate_expectation: "",
};

export default function OfferForm() {
  const router = useRouter();
  const [f, setF] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState("");
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  // Ashby candidate search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AshbyCandidate[]>([]);
  const [sample, setSample] = useState(false);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ashby/candidates?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setResults(json.candidates);
        setSample(json.sample);
        setSearchError("");
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "Search failed");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function pick(c: AshbyCandidate) {
    setF((prev) => ({
      ...prev,
      ashby_candidate_id: c.id,
      candidate_name: c.name,
      personal_email: c.email,
      job_title_contract: c.job_title || prev.job_title_contract,
      manager: c.hiring_manager || prev.manager,
      work_location: /nyc|new york/i.test(c.job_title) ? "New York" : prev.work_location,
      legal_entity: /nyc|new york/i.test(c.job_title) ? "Deel PEO (US)" : prev.legal_entity,
    }));
    setQuery("");
    setResults([]);
  }

  const d = useMemo(
    () => derive({ legal_entity: f.legal_entity, base_salary_annual: Number(f.base_salary_annual), rsu_total: Number(f.rsu_total) }),
    [f.legal_entity, f.base_salary_annual, f.rsu_total],
  );
  const money = (n: number) => formatMoney(n, d.currency);
  const startWarning = f.start_date && !isWorkingDay(f.start_date, f.legal_entity) ? "Not a working day" : "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createOfferAction({
        ...f,
        hours_per_week: Number(f.hours_per_week),
        base_salary_annual: Number(f.base_salary_annual),
        rsu_total: Number(f.rsu_total || 0),
        relocation_amount: f.relocation_amount ? Number(f.relocation_amount) : null,
      });
      if (!res.ok) {
        setErrors(res.errors);
        setSaveError(res.saveError ?? "");
        return;
      }
      router.push(`/offers/${res.id}?created=1`);
    });
  }

  const err = (k: keyof OfferInput) => (errors[k] ? <div className="err">{errors[k]}</div> : null);

  return (
    <form onSubmit={submit} noValidate>
      <section className="card">
        <h2>Candidate</h2>
        <div className="grid">
          <div className="full">
            <label htmlFor="search">Find in Ashby <span className="hint">{sample ? "· sample data (no Ashby key set)" : ""}</span></label>
            <input id="search" placeholder="Name or email" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            {searchError && <div className="err">{searchError}</div>}
            {results.length > 0 && (
              <div className="suggest">
                {results.map((c) => (
                  <button type="button" key={c.id} onClick={() => pick(c)}>
                    <strong>{c.name}</strong> · {c.email} {c.job_title && <>· {c.job_title}</>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="candidate_name">Name</label>
            <input id="candidate_name" value={f.candidate_name} onChange={(e) => set("candidate_name", e.target.value)} />
            {err("candidate_name")}
          </div>
          <div>
            <label htmlFor="personal_email">Personal email</label>
            <input id="personal_email" type="email" value={f.personal_email} onChange={(e) => set("personal_email", e.target.value)} />
            {err("personal_email")}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Role</h2>
        <div className="grid">
          <div>
            <label htmlFor="job_title_contract">Job title (contract) <span className="hint">· defaults to Ashby</span></label>
            <input id="job_title_contract" value={f.job_title_contract} onChange={(e) => set("job_title_contract", e.target.value)} />
            {err("job_title_contract")}
          </div>
          <div>
            <label htmlFor="manager">Manager <span className="hint">· defaults to hiring manager</span></label>
            <input id="manager" value={f.manager} onChange={(e) => set("manager", e.target.value)} />
            {err("manager")}
          </div>
          <div>
            <label htmlFor="work_location">Work location</label>
            <select id="work_location" value={f.work_location} onChange={(e) => set("work_location", e.target.value as FormState["work_location"])}>
              {WORK_LOCATIONS.map((x) => <option key={x}>{x}</option>)}
            </select>
            {err("work_location")}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Contract</h2>
        <div className="grid">
          <div>
            <label htmlFor="legal_entity">Legal entity</label>
            <select id="legal_entity" value={f.legal_entity} onChange={(e) => set("legal_entity", e.target.value as FormState["legal_entity"])}>
              {LEGAL_ENTITIES.map((x) => <option key={x}>{x}</option>)}
            </select>
            {err("legal_entity")}
          </div>
          <div>
            <label htmlFor="contract_type">Contract type</label>
            <select id="contract_type" value={f.contract_type} onChange={(e) => set("contract_type", e.target.value as FormState["contract_type"])}>
              {CONTRACT_TYPES.map((x) => <option key={x}>{x}</option>)}
            </select>
            {err("contract_type")}
          </div>
          <div>
            <label htmlFor="start_date">Start date</label>
            <input id="start_date" type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
            {errors.start_date ? err("start_date") : startWarning && <div className="err">{startWarning}</div>}
          </div>
          {f.contract_type === "Fixed-term" && (
            <div>
              <label htmlFor="end_date">End date</label>
              <input id="end_date" type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
              {err("end_date")}
            </div>
          )}
          <div>
            <label htmlFor="hours_per_week">Hours per week</label>
            <input id="hours_per_week" type="number" min={1} max={48} value={f.hours_per_week} onChange={(e) => set("hours_per_week", e.target.value)} />
            {err("hours_per_week")}
            {Number(f.hours_per_week) !== DEFAULT_HOURS && !errors.hours_per_week && (
              <div className="err" style={{ color: "var(--warn)" }}>Templates assume 40 hours, so part-time is a deviation for Legal.</div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Compensation ({d.currency})</h2>
        <div className="grid">
          <div>
            <label htmlFor="base_salary_annual">Base salary, annual</label>
            <input id="base_salary_annual" type="number" min={0} step="any" value={f.base_salary_annual} onChange={(e) => set("base_salary_annual", e.target.value)} />
            {err("base_salary_annual")}
          </div>
          <div>
            <label htmlFor="rsu_total">RSU total <span className="hint">· over 3 years</span></label>
            <input id="rsu_total" type="number" min={0} step="any" value={f.rsu_total} onChange={(e) => set("rsu_total", e.target.value)} />
            {err("rsu_total")}
          </div>
          <div>
            <label htmlFor="relocation_amount">Relocation <span className="hint">· optional</span></label>
            <input id="relocation_amount" type="number" min={0} step="any" value={f.relocation_amount} onChange={(e) => set("relocation_amount", e.target.value)} />
            {err("relocation_amount")}
          </div>
        </div>
        <div className="totals" style={{ marginTop: 16 }}>
          {f.legal_entity === "Prior Labs GmbH" && (
            <div className="stat"><div className="k">Monthly gross</div><div className="v">{money(d.base_salary_monthly_gross)}</div></div>
          )}
          <div className="stat"><div className="k">RSU per year</div><div className="v">{money(d.rsu_annual)}</div></div>
          <div className="stat"><div className="k">Total comp, annual</div><div className="v">{money(d.total_comp_annual)}</div></div>
        </div>
      </section>

      <section className="card">
        <h2>For the approvers</h2>
        <div className="grid">
          <div className="full">
            <label htmlFor="rationale">Rationale <span className="hint">· why this package; shown to Noah and Sauraj</span></label>
            <textarea id="rationale" value={f.rationale} onChange={(e) => set("rationale", e.target.value)} />
            {err("rationale")}
          </div>
          <div className="full">
            <label htmlFor="candidate_expectation">Candidate expectation <span className="hint">· optional: ask and competing offers</span></label>
            <input id="candidate_expectation" value={f.candidate_expectation} onChange={(e) => set("candidate_expectation", e.target.value)} />
          </div>
        </div>
      </section>

      <div className="row">
        <button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit for approval"}</button>
        {Object.keys(errors).length > 0 && <span className="err">Fix the highlighted fields.</span>}
        {saveError && <span className="err">{saveError}</span>}
      </div>
    </form>
  );
}
