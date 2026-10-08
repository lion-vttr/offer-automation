# Offer to Contract (MVP, flows 1–5)

Recruiter proposes, founders approve, Claude drafts the offer, reads the
acceptance, and generates the contract. Flow page:
https://claude.ai/artifact/UJEQprBSUssZHb11hhCMUG

| Flow | Where it runs |
|---|---|
| 1 · Propose | This web app: `/offers/new` writes the Offers row (Pending approval) |
| 2 · Approve | Claude routine [`routines/2-approve.md`](routines/2-approve.md): Slack post, Noah + Sauraj decide on the Notion row |
| 3 · Offer out | Claude routine [`routines/3-offer-out.md`](routines/3-offer-out.md): offer letter + Gmail draft, Jerry sends |
| 4 · Acceptance | Claude routine [`routines/4-acceptance.md`](routines/4-acceptance.md): reads the reply, fills Candidate Details |
| 5 · Contract | Claude routine [`routines/5-contract.md`](routines/5-contract.md): fills the contract; Jerry sends it via DocuSign for now |

All data lives in Notion: offers, candidate details and templates (including
the uploaded .docx files). The app keeps nothing on the computer it runs on
except the Notion connection token in `.data/`. It can also fill the templates
for any offer, so the documents can be checked before the routines run.

## Run it

```bash
npm install
cp .env.example .env.local   # optional, see below
npm run dev                  # http://localhost:3000
npm test
```

Notion is required: set `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET` in
`.env.local`, start the app and click **Connect Notion**, selecting the
"Offer to Contract MVP" page (or set an internal `NOTION_TOKEN` instead). The
three database IDs are in `.env.example`. Without `ASHBY_API_KEY` the form
uses sample candidates.

## Templates

`/templates` has one slot per document × entity × contract type. Each slot
takes a .docx upload (stored in the Templates database's File column), a Google
Docs link, and the MD signatory for contracts. Everything is saved to the
Notion Templates row, and edits made in Notion show up here. Placeholders are
written `{{field}}`; the page lists every field.

## Notion

Under the private page "Offer to Contract MVP":
https://app.notion.com/p/3f35be1f3b49815188f3dddd614fe179

- **Offers**: one row per offer; the form fields, both approvals, status, links.
- **Candidate Details**: filled from the acceptance reply. Restrict to Talent and Legal.
- **Templates**: template links and MD signatory per entity and contract type.

## Not yet

Ashby and Notion credentials, Gmail connected as Jerry, DocuSign API, filing the
signed contract, Ashby to Hired, onboarding handover (the "After the MVP" list on
the flow page).
