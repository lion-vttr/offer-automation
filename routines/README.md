# Claude routines (flows 2–5)

Each file here is the prompt for one scheduled Claude task. They run every
15 minutes on weekdays, 08:00–19:00 Berlin time, using the Notion, Slack, Gmail
and Google Drive connectors. Gmail and Slack must be connected as Jerry
(jerry@priorlabs.ai), so posts and drafts come from him.

| Routine | Picks up rows with | Does | Leaves the row at |
|---|---|---|---|
| [2-approve.md](2-approve.md) | Status = Pending approval | Posts to Slack, checks both decisions | Approved / Changes requested / Rejected |
| [3-offer-out.md](3-offer-out.md) | Status = Approved | Fills the offer letter, creates a Gmail draft, detects when Jerry sent it | Sent |
| [4-acceptance.md](4-acceptance.md) | Status = Sent | Reads candidate replies, fills Candidate Details, drafts follow-ups | Accepted (after Jerry confirms) |
| [5-contract.md](5-contract.md) | Status = Accepted | Fills the contract in Drive, marks signature places, asks Jerry to send via DocuSign | Out for signature (Jerry sets it) |

## Notion IDs

| Database | Data source |
|---|---|
| Offers | `collection://dbccc20d-54f7-4fb9-be8b-87de3d4ab289` |
| Candidate Details (restricted) | `collection://80f334ee-f4d9-4c6d-ba7d-7997c118c2b1` |
| Templates | `collection://ea67c6b9-fcff-4c51-999d-924204e777ae` |

Parent page: https://app.notion.com/p/3f35be1f3b49815188f3dddd614fe179

## Rules every routine follows

- Never send an email. Only create Gmail drafts in Jerry's inbox.
- Never edit a clause of a template. Only replace `{{field}}` placeholders.
- Never post candidate personal data (address, date of birth, nationality,
  right to work) in Slack. It lives only in Candidate Details.
- Answer candidate questions only from *Information for Offer Holders*.
  Questions about numbers or terms go to Jerry; contract and start-date
  questions go to Clara.
- If something is unclear, stop for that row and tell Jerry in Slack rather
  than guessing.
