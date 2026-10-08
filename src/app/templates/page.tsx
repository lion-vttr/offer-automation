import { removeTemplateAction, saveTemplateAction } from "@/app/actions";
import { TEMPLATE_SLOTS, listTemplates } from "@/lib/store";
import { TOKENS } from "@/lib/templating";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await listTemplates();
  return (
    <>
      <h1>Templates</h1>
      <p className="sub">
        Upload the approved .docx for each slot, or paste its Google Docs link for the Claude routines. Placeholders use{" "}
        <code>{"{{field}}"}</code>; the list of fields is at the bottom of the page.
      </p>

      {TEMPLATE_SLOTS.map((slot) => {
        const t = templates[slot.key];
        return (
          <section className="card" key={slot.key}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{slot.label}</h2>
              {t?.filename || t?.link ? <span className="pill ok">Ready</span> : <span className="pill muted">Empty</span>}
            </div>
            <form action={saveTemplateAction}>
              <input type="hidden" name="key" value={slot.key} />
              <div className="grid">
                <div>
                  <label htmlFor={`${slot.key}-file`}>
                    .docx file <span className="hint">{t?.filename ? "· uploaded, choose a file to replace" : ""}</span>
                  </label>
                  <input id={`${slot.key}-file`} name="file" type="file" accept=".docx" />
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
                <button type="submit" className="secondary">Save</button>
                {t?.filename && (
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
