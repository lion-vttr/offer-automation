import { removeTemplateAction, saveTemplateAction } from "@/app/actions";
import type { NotionTemplate } from "@/lib/notion";
import { notionConnected } from "@/lib/notion";
import { TEMPLATE_SLOTS, listTemplates } from "@/lib/store";
import { TOKENS } from "@/lib/templating";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; removed?: string; error?: string; slot?: string }>;
}) {
  const sp = await searchParams;
  const slotLabel = TEMPLATE_SLOTS.find((s) => s.key === sp.slot)?.label;
  const connected = await notionConnected();
  let templates: Record<string, NotionTemplate> = {};
  let loadError = "";
  if (connected) {
    try {
      templates = await listTemplates();
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <>
      {sp.saved && <div className="notice ok">Saved {slotLabel} to the Notion Templates database.</div>}
      {sp.removed && <div className="notice ok">Removed the file from {slotLabel} in Notion.</div>}
      {sp.error && <div className="notice">Couldn&apos;t save {slotLabel} to Notion: {sp.error}</div>}
      {loadError && <div className="notice">Couldn&apos;t read the Notion Templates database: {loadError}</div>}
      {!connected && <div className="notice">Connect Notion on the Offers page first. Templates are stored there.</div>}

      <h1>Templates</h1>
      <p className="sub">
        Everything here is stored in the Notion Templates database: the uploaded .docx (in its File column), the Google Docs
        link, and the MD signatory. Edit them here or in Notion. Placeholders use <code>{"{{field}}"}</code>; the list of
        fields is at the bottom of the page.
      </p>

      {TEMPLATE_SLOTS.map((slot) => {
        const t = templates[slot.key];
        return (
          <section className="card" key={slot.key} id={slot.key}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{slot.label}</h2>
              {t?.file || t?.link ? <span className="pill ok">Ready</span> : <span className="pill muted">Empty</span>}
            </div>
            <form action={saveTemplateAction}>
              <input type="hidden" name="key" value={slot.key} />
              <div className="grid">
                <div>
                  <label htmlFor={`${slot.key}-file`}>
                    .docx file <span className="hint">{t?.file ? `· ${t.file.name}, choose a file to replace` : ""}</span>
                  </label>
                  <input id={`${slot.key}-file`} name="file" type="file" accept=".docx" disabled={!connected} />
                </div>
                <div>
                  <label htmlFor={`${slot.key}-link`}>Google Docs link</label>
                  <input id={`${slot.key}-link`} name="link" type="url" defaultValue={t?.link ?? ""} placeholder="https://docs.google.com/…" />
                </div>
                {slot.kind === "contract" && (
                  <>
                    <div>
                      <label htmlFor={`${slot.key}-md`}>MD signatory</label>
                      <input id={`${slot.key}-md`} name="md_signatory" defaultValue={t?.md_signatory ?? ""} />
                    </div>
                    <div>
                      <label htmlFor={`${slot.key}-mde`}>MD signatory email</label>
                      <input id={`${slot.key}-mde`} name="md_signatory_email" type="email" defaultValue={t?.md_signatory_email ?? ""} />
                    </div>
                  </>
                )}
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <button type="submit" className="secondary" disabled={!connected}>Save</button>
                {t?.file && (
                  <button type="submit" className="secondary" formAction={removeTemplateAction}>Remove file</button>
                )}
              </div>
            </form>
          </section>
        );
      })}

      <section className="card table-wrap">
        <h2>Placeholders</h2>
        <table>
          <thead><tr><th>Write in the template</th><th>Filled with</th></tr></thead>
          <tbody>
            {TOKENS.map((t) => (
              <tr key={t.token}><td><code>{`{{${t.token}}}`}</code></td><td>{t.description}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
