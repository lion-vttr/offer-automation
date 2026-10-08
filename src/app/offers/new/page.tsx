import OfferForm from "./OfferForm";

export default function NewOfferPage() {
  return (
    <>
      <h1>New offer</h1>
      <p className="sub">Flow 1 · Propose. Submitting creates the Offers row with status Pending approval.</p>
      <OfferForm />
    </>
  );
}
