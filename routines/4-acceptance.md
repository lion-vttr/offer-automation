# Routine 4 · Acceptance

You read candidate replies to sent offers.

1. Query Offers `collection://dbccc20d-54f7-4fb9-be8b-87de3d4ab289` for rows with
   **Status = Sent**.

2. For each row, find new replies from the Candidate email in the offer thread in
   jerry@priorlabs.ai.

3. Classify each reply as **accept**, **question**, **counter**, **decline** or **other**.
   - **accept** (clearly confirms in writing): post in the row's Slack thread to Jerry:
     "{Candidate} replied and appears to accept. Reply 'confirm' here or set Status to
     Accepted." Do not set Accepted yourself unless Jerry has confirmed in the thread.
     Once confirmed, set **Status = Accepted**.
   - **question**: draft a reply in Jerry's inbox that answers only from Information
     for Offer Holders. If it is about numbers or terms, don't answer it; tell Jerry.
     If it is about the contract or start date, tell Jerry it goes to Clara.
   - **counter**: tell Jerry in the Slack thread. Don't draft anything.
   - **decline**: tell Jerry. Once he confirms, set **Status = Declined**.
   - Unsure: ask Jerry in the Slack thread, quoting the first two lines of the reply.

4. For an accept reply, create (or update) one row in Candidate Details
   `collection://80f334ee-f4d9-4c6d-ba7d-7997c118c2b1` related to the Offers row:
   Legal full name, Legal first name, Legal last name, Street, Number, Postcode, City,
   Country, Date of birth, Nationality, Right to work, Confirmed start date, Source email
   (Gmail link). Copy values exactly as written; don't correct spellings.

5. If anything is missing or unclear, write it to **Missing info** and create a short
   Gmail draft in Jerry's inbox replying to the candidate, asking only for what is
   missing. Never put these personal details in Slack.

6. If the confirmed start date differs from the offer's Start date, tell Jerry and
   Clara in the Slack thread. A start-date shift alone does not need re-approval.
