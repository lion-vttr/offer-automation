# Routine 2 · Approve

You run the approval step of the offer-to-contract flow.

1. Query the Notion Offers data source `collection://dbccc20d-54f7-4fb9-be8b-87de3d4ab289`
   for rows where **Status = Pending approval**.

2. For each row where **Slack posted** is unchecked, post to Slack channel
   **#jerry-and-founders**:

   ```
   *Offer for approval: {Candidate}*
   {Job title (contract)} · {Work location} · {Legal entity} · {Contract type}
   Start {Start date}[, ends {End date}] · {Hours per week} h/week

   Base: {Base salary (annual)}[ ({Monthly gross}/month) for Prior Labs GmbH]
   RSU: {RSU total} over 3 years ({RSU per year}/year)
   [Relocation: {Relocation}]
   *Total comp: {Total comp (annual)}/year*

   Rationale: {Rationale}
   [Candidate expectation: {Candidate expectation}]

   Noah, Sauraj: please set your decision (Approve / Changes / Reject) and a comment on the Notion row: {row link}
   ```

   Amounts use the row's Currency. Then:
   - Check **Slack posted**.
   - Set **Terms hash** to a short fingerprint of the terms. Join these fields with `|`:
     Legal entity, Contract type, Start date, End date, Hours per week,
     Base salary (annual), RSU total, Relocation, Job title (contract),
     Work location. Then store that string in Terms hash. The point is to
     detect edits, not to be cryptographically strong.

3. For each row where **Slack posted** is checked:
   - Rebuild the terms string. If it differs from **Terms hash**, the terms were edited after
     posting: clear Noah decision/comment/decided and Sauraj decision/comment/decided,
     store the new Terms hash, and reply in the Slack thread "Terms changed, approvals reset" with
     the new numbers.
   - If **Noah decision** and **Sauraj decision** are both **Approve**: set Status to **Approved**
     and reply in the thread "Approved by Noah and Sauraj. Claude will prepare the offer draft."
   - If either is **Reject**: set Status to **Rejected** and reply in the thread with the comment.
   - If either is **Changes**: set Status to **Changes requested** and reply in the thread, tagging
     Jerry, with both comments. Then clear both decisions and dates (keep the comments) and uncheck
     **Slack posted**. When Jerry has edited the row and set it back to Pending approval,
     step 2 posts it again as a new round.
   - If a decision is still empty more than 24 hours after posting, reply once in the thread
     reminding whoever hasn't decided.

4. If a decision date (Noah decided / Sauraj decided) is empty but the decision is set, set the
   date to today.
