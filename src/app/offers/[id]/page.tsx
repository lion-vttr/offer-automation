import Link from "next/link";
import { notFound } from "next/navigation";
import { saveDetailsAction } from "@/app/actions";
import { approvalMessage, offerEmailBody } from "@/lib/messages";
import { formatDate, formatMoney } from "@/lib/offer";
import { getOffer, listTemplates, slotFor } from "@/lib/store";

export const dynamic = "force-dynamic";

const RIGHT_TO_WORK = ["EU/EEA citizen", "Existing permit", "Needs DE sponsorship", "US citizen or GC", "Needs US visa"];

export default async function OfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; notionError?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const offer = await getOffer(id);
  if (!offer) notFound();

  const templates = await listTemplates();
  const letter = templates[slotFor("offer_letter", offer).key];
  const contract = templates[slotFor("contract", offer).key];
  const m = (n: number) => formatMoney(n, offer.currency);
  const d = offer.candidate_details;
  const save = saveDetailsAction.bind(null, offer.id);

  return (
    <>
      {sp.created && (
        <div className="notice ok">
          Offer submitted. {offer.notion_url ? "The row is in Notion." : "Saved locally; Notion is not connected yet (see the Offers page)."}
        </div>
      )}
      {sp.notionError && <div className="notice">Saved locally, but writing to Notion failed: {sp.notionError}</div>}

      <div className="spread">
        <div>
          <h1>{offer.candidate_name}</h1>
          <p className="sub">{offer.job_title_contract} · {offer.legal_entity} · {offer.contract_type}</p>
        </div>
        <div className="row">
          <span className="pill">{offer.status}</span>
          {offer.notion_url && <a className="btn secondary" href={offer.notion_url} target="_blank">Open in Notion</a>}
        </div>
      </div>

      <section className="card">
        <h2>Package</h2>
        <div className="totals" style={{ marginBottom: 16 }}>
          <div className="stat"><div className="k">Base, annual</div><div className="v">{m(offer.base_salary_annual)}</div></div>
          {offer.legal_entity === "Prior Labs GmbH" && (
            <div className="stat"><div className="k">Monthly gross</div><div className="v">{m(offer.base_salary_monthly_gross)}</div></div>
          )}
          <div className="stat"><div className="k">RSU per year</div><div className="v">{m(offer.rsu_annual)}</div></div>
          <div className="stat"><div className="k">Total comp</div><div className="v">{m(offer.total_comp_annual)}</div></div>
        </div>
        <dl className="kv">
          <dt>Email</dt><dd>{offer.personal_email}</dd>
          <dt>Manager</dt><dd>{offer.manager}</dd>
          <dt>Location</dt><dd>{offer.work_location}</dd>
          <dt>Start</dt><dd>{formatDate(offer.start_date)}</dd>
          {offer.contract_type === "Fixed-term" && (<><dt>End</dt><dd>{formatDate(offer.end_date)}</dd></>)}
          <dt>Hours</dt><dd>{offer.hours_per_week} per week</dd>
          <dt>RSU total</dt><dd>{m(offer.rsu_total)}</dd>
          <dt>Relocation</dt><dd>{offer.relocation_amount ? m(offer.relocation_amount) : "None"}</dd>
          <dt>Rationale</dt><dd>{offer.rationale}</dd>
          {offer.candidate_expectation && (<><dt>Expectation</dt><dd>{offer.candidate_expectation}</dd></>)}
        </dl>
      </section>

      <section className="card">
        <h2>2 · Approval post for #jerry-and-founders</h2>
        <p className="sub">The approval routine posts this once the row is in Notion.</p>
        <pre className="preview">{approvalMessage(offer)}</pre>
      </section>

      <section className="card">
        <h2>3 · Offer letter and email</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          {letter?.filename ? (
            <a className="btn" href={`/api/offers/${offer.id}/document?kind=offer_letter`}>Download filled offer letter</a>
          ) : (
            <span className="pill muted">No offer letter template yet · <Link href="/templates">add one</Link></span>
          )}
        </div>
        <pre className="preview">{offerEmailBody(offer)}</pre>
      </section>

      <section className="card">
        <h2>4 · Contract details from the acceptance reply</h2>
        <p className="sub">The acceptance routine writes these to Candidate Details in Notion. You can also enter them here to fill a contract locally.</p>
        <form action={save}>
          <div className="grid">
            <Field name="legal_first_name" label="Legal first name" value={d?.legal_first_name} />
            <Field name="legal_last_name" label="Legal last name" value={d?.legal_last_name} />
            <Field name="address_street" label="Street" value={d?.address_street} />
            <Field name="address_number" label="Number" value={d?.address_number} />
            <Field name="postcode" label="Postcode" value={d?.postcode} />
            <Field name="city" label="City" value={d?.city} />
            <Field name="country" label="Country" value={d?.country} />
            <Field name="date_of_birth" label="Date of birth" type="date" value={d?.date_of_birth} />
            <Field name="nationality" label="Nationality" value={d?.nationality} />
            <div>
              <label htmlFor="right_to_work">Right to work</label>
              <select id="right_to_work" name="right_to_work" defaultValue={d?.right_to_work ?? ""}>
                <option value="">–</option>
                {RIGHT_TO_WORK.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <Field name="confirmed_start_date" label="Confirmed start date" type="date" value={d?.confirmed_start_date || offer.start_date} />
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="submit" className="secondary">Save details</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>5 · Contract</h2>
        <p className="sub">Fills the {offer.legal_entity} {offer.contract_type.toLowerCase()} template. No clause is edited; any field still empty shows as [[MISSING: …]] in the document.</p>
        <div className="row">
          {contract?.filename ? (
            <a className="btn" href={`/api/offers/${offer.id}/document?kind=contract`}>Download filled contract</a>
          ) : (
            <span className="pill muted">No contract template yet · <Link href="/templates">add one</Link></span>
          )}
          {contract?.md_signatory && <span className="sub" style={{ margin: 0 }}>MD signatory: {contract.md_signatory}</span>}
        </div>
      </section>
    </>
  );
}

function Field({ name, label, value, type = "text" }: { name: string; label: string; value?: string; type?: string }) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value ?? ""} />
    </div>
  );
}
