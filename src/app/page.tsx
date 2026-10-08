import Link from "next/link";
import { disconnectNotionAction } from "@/app/actions";
import { notionConnected, oauthConfigured, readOAuth } from "@/lib/notion";
import { formatDate, formatMoney, type Offer } from "@/lib/offer";
import { listOffers } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ notion?: string; notionError?: string }>;
}) {
  const sp = await searchParams;
  const connected = await notionConnected();
  let offers: Offer[] = [];
  let loadError = "";
  if (connected) {
    try {
      offers = await listOffers();
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }
  const oauth = await readOAuth();
  const viaToken = Boolean(process.env.NOTION_TOKEN);
  return (
    <>
      {sp.notion === "connected" && <div className="notice ok">Notion is connected. New offers will be written to the Offers database.</div>}
      {sp.notionError && <div className="notice">Connecting Notion failed: {sp.notionError}</div>}
      {loadError && <div className="notice">Couldn&apos;t read offers from Notion: {loadError}</div>}
      <div className="spread">
        <div>
          <h1>Offers</h1>
          <p className="sub">Every offer in the Notion Offers database, with its current values. Approvals and later steps happen on the Notion row.</p>
        </div>
        <Link className="btn" href="/offers/new">New offer</Link>
      </div>
      <section className="card">
        <div className="spread">
          <div>
            <h2 style={{ margin: 0 }}>Notion</h2>
            <p className="sub" style={{ margin: 0 }}>
              {viaToken
                ? "Connected with NOTION_TOKEN."
                : oauth
                  ? `Connected${oauth.workspace_name ? ` to ${oauth.workspace_name}` : ""}. New offers are written to the Offers database.`
                  : oauthConfigured()
                    ? "Not connected. Connect Notion to see and create offers; everything is stored there."
                    : "Not connected. Add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET to .env.local and restart the app."}
            </p>
          </div>
          {!viaToken && oauthConfigured() && (
            oauth ? (
              <form action={disconnectNotionAction}><button type="submit" className="secondary">Disconnect</button></form>
            ) : (
              <a className="btn" href="/api/notion/connect">Connect Notion</a>
            )
          )}
        </div>
      </section>

      <div className="card table-wrap">
        {!connected ? (
          <p className="sub" style={{ margin: 0 }}>Connect Notion to see offers.</p>
        ) : offers.length === 0 ? (
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
