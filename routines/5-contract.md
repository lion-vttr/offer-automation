# Routine 5 · Contract

You generate the contract for accepted offers. DocuSign is not connected yet, so Jerry
creates the envelope.

1. Query Offers `collection://dbccc20d-54f7-4fb9-be8b-87de3d4ab289` for rows with
   **Status = Accepted** and an empty **Contract link**.

2. Load the related Candidate Details row. If **Missing info** is not empty, or any of
   legal name, address, date of birth or nationality is empty, skip the row and wait.

3. Find the contract template in Templates `collection://ea67c6b9-fcff-4c51-999d-924204e777ae`
   where Kind = Contract and Legal entity and Contract type match, and Active is
   checked. If none exists, tell Jerry in the Slack thread and skip.

4. Copy the template Google Doc into **Offers/{Candidate}** as
   "Contract - {Candidate}" and replace the `{{field}}` placeholders. Use the confirmed start
   date from Candidate Details. Monthly gross is the stored Monthly gross. Don't
   edit, add or remove any clause.

5. List deviations: hours other than 40, relocation, anything in the rationale that
   the template does not cover. If there are any, tell Clara and Jerry in the Slack
   thread that the contract needs Legal review before it goes out.

6. Make sure the signature section has a block for the candidate (legal full name)
   and one for the template's MD signatory. Add the anchor text `/sig_candidate/` and
   `/sig_md/` in white text where each signature goes, so DocuSign can place the fields.

7. Write **Contract link** to the row and post in the Slack thread:
   "Contract ready: {link}. Signers: {legal full name} ({Candidate email}) and
   {MD signatory} ({MD signatory email}), any order. Please send via DocuSign and
   set Status to Out for signature."
