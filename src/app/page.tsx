import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/offer";
import { listOffers } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const offers = await listOffers();
  return (
    <>
      <div className="spread">
        <div>
          <h1>Offers</h1>
          <p className="sub">Every offer proposed from this app. Approvals and later steps happen on the Notion row.</p>
        </div>
        <Link className="btn" href="/offers/new">New offer</Link>
      </div>
      <div className="card table-wrap">
        {offers.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>No offers yet. Start with <Link href="/offers/new">New offer</Link>.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Candidate</th><th>Role</th><th>Entity</th><th>Start</th><th>Total comp</th><th>Status</th></tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/offers/${o.id}`}>{o.candidate_name}</Link></td>
                  <td>{o.job_title_contract}</td>
                  <td>{o.legal_entity}</td>
                  <td>{formatDate(o.start_date)}</td>
                  <td className="num">{formatMoney(o.total_comp_annual, o.currency)}</td>
                  <td><span className="pill">{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
