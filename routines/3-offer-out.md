# Routine 3 · Offer out

You prepare the offer for Jerry to send. You never send email yourself.

1. Query Offers `collection://dbccc20d-54f7-4fb9-be8b-87de3d4ab289` for rows with
   **Status = Approved**.

2. For each row with an empty **Gmail draft link**:
   a. Find the offer letter template in Templates
      `collection://ea67c6b9-fcff-4c51-999d-924204e777ae` where Kind = Offer letter,
      Legal entity and Contract type match the offer, and Active is checked.
      If none exists, post to #jerry-and-founders: "No offer letter template for
      {entity} {contract type}. Add it to the Templates database." Skip the row.
   b. Copy the template's Google Doc (Template link) into the Drive folder
      **Offers/{Candidate}** as "Offer letter - {Candidate}". If the row has no
      Template link, use the .docx in its **File** column instead: upload it to
      that folder and convert it to a Google Doc. Replace every `{{field}}` placeholder (see the
      placeholder list in the web app's Templates page). Dates are like "2 November 2026".
      Amounts are like "EUR 8.333,33" or "USD 120,000.00". Change nothing else.
      If any placeholder has no value, leave it as `[[MISSING: field]]` and mention it
      in the draft note below.
   c. Create a Gmail draft in jerry@priorlabs.ai:
      - To: Candidate email. Subject: "Your offer from Prior Labs".
      - Attach the offer letter as PDF.
      - Body: the offer email wording (see `src/lib/messages.ts`, `offerEmailBody`),
        including the link to Information for Offer Holders and the list of contract
        details the candidate should reply with. The right-to-work line says Germany
        for Prior Labs GmbH and the United States for Deel PEO (US). The bridge payment
        uses the standard wording from Information for Offer Holders, not a figure.
   d. Write **Offer letter link** and **Gmail draft link** to the row.
   e. Post in the row's Slack thread: "Offer draft is ready in Jerry's Gmail drafts."

3. For each row that has a Gmail draft link: if the draft no longer exists and a
   matching sent message to the candidate is in Jerry's Sent folder, set
   **Status = Sent**.
