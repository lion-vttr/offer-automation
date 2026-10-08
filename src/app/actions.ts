"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { disconnect as disconnectNotion } from "@/lib/notion";
import { validate, type CandidateDetails, type Errors, type OfferInput } from "@/lib/offer";
import { createOffer, removeTemplateFile, saveCandidateDetails, saveTemplate } from "@/lib/store";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export type CreateOfferResult =
  | { ok: false; errors: Errors; saveError?: string }
  | { ok: true; id: string };

export async function createOfferAction(input: OfferInput): Promise<CreateOfferResult> {
  const clean: OfferInput = {
    ...input,
    end_date: input.contract_type === "Fixed-term" ? input.end_date : "",
    hours_per_week: Number(input.hours_per_week),
    base_salary_annual: Number(input.base_salary_annual),
    rsu_total: Number(input.rsu_total || 0),
    relocation_amount: input.relocation_amount ? Number(input.relocation_amount) : null,
  };
  const errors = validate(clean);
  if (Object.keys(errors).length) return { ok: false, errors };
  try {
    const offer = await createOffer(clean);
    revalidatePath("/");
    return { ok: true, id: offer.id };
  } catch (e) {
    return { ok: false, errors: {}, saveError: `Couldn't save to Notion: ${message(e)}` };
  }
}

export async function saveDetailsAction(id: string, formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const details: CandidateDetails = {
    legal_first_name: get("legal_first_name"),
    legal_last_name: get("legal_last_name"),
    address_street: get("address_street"),
    address_number: get("address_number"),
    postcode: get("postcode"),
    city: get("city"),
    country: get("country"),
    date_of_birth: get("date_of_birth"),
    nationality: get("nationality"),
    right_to_work: get("right_to_work"),
    confirmed_start_date: get("confirmed_start_date"),
  };
  let result = "detailsSaved=1";
  try {
    await saveCandidateDetails(id, details);
  } catch (e) {
    result = `error=${encodeURIComponent(message(e))}`;
  }
  revalidatePath(`/offers/${id}`);
  redirect(`/offers/${id}?${result}#details`);
}

export async function saveTemplateAction(formData: FormData) {
  const key = String(formData.get("key"));
  const file = formData.get("file");
  let result = "saved=1";
  try {
    let upload: { data: Buffer; name: string } | undefined;
    if (file instanceof File && file.size > 0) {
      if (!file.name.toLowerCase().endsWith(".docx")) throw new Error("Upload a .docx file.");
      if (file.size > 20 * 1024 * 1024) throw new Error("The file is larger than 20 MB, which Notion doesn't accept.");
      upload = { data: Buffer.from(await file.arrayBuffer()), name: file.name };
    }
    await saveTemplate(key, {
      link: String(formData.get("link") ?? "").trim() || null,
      md_signatory: String(formData.get("md_signatory") ?? "").trim(),
      md_signatory_email: String(formData.get("md_signatory_email") ?? "").trim(),
      file: upload,
    });
  } catch (e) {
    result = `error=${encodeURIComponent(message(e))}`;
  }
  revalidatePath("/templates");
  redirect(`/templates?${result}&slot=${encodeURIComponent(key)}#${encodeURIComponent(key)}`);
}

export async function removeTemplateAction(formData: FormData) {
  const key = String(formData.get("key"));
  let result = "removed=1";
  try {
    await removeTemplateFile(key);
  } catch (e) {
    result = `error=${encodeURIComponent(message(e))}`;
  }
  revalidatePath("/templates");
  redirect(`/templates?${result}&slot=${encodeURIComponent(key)}#${encodeURIComponent(key)}`);
}

export async function disconnectNotionAction() {
  await disconnectNotion();
  revalidatePath("/");
}
