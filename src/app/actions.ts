"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { disconnect as disconnectNotion } from "@/lib/notion";
import { validate, type CandidateDetails, type Errors, type OfferInput } from "@/lib/offer";
import {
  TEMPLATE_DIR,
  TEMPLATE_SLOTS,
  createOffer,
  listTemplates,
  removeTemplateFile,
  saveCandidateDetails,
  saveTemplate,
} from "@/lib/store";

export type CreateOfferResult = { ok: false; errors: Errors } | { ok: true; id: string; notionError: string | null };

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
  const { offer, notionError } = await createOffer(clean);
  revalidatePath("/");
  return { ok: true, id: offer.id, notionError };
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
  await saveCandidateDetails(id, details);
  revalidatePath(`/offers/${id}`);
}

export async function saveTemplateAction(formData: FormData) {
  const key = String(formData.get("key"));
  if (!TEMPLATE_SLOTS.some((s) => s.key === key)) throw new Error("Unknown template slot");
  const existing = (await listTemplates())[key];
  const file = formData.get("file");

  let filename = existing?.filename ?? null;
  if (file instanceof File && file.size > 0) {
    if (!file.name.toLowerCase().endsWith(".docx")) throw new Error("Upload a .docx file");
    await fs.mkdir(TEMPLATE_DIR, { recursive: true });
    if (filename) await fs.rm(path.join(TEMPLATE_DIR, filename), { force: true });
    filename = `${key}.docx`;
    await fs.writeFile(path.join(TEMPLATE_DIR, filename), Buffer.from(await file.arrayBuffer()));
  }

  let result: string;
  try {
    const synced = await saveTemplate({
      key,
      filename,
      link: String(formData.get("link") ?? "").trim() || null,
      md_signatory: String(formData.get("md_signatory") ?? "").trim(),
      md_signatory_email: String(formData.get("md_signatory_email") ?? "").trim(),
      updated_at: new Date().toISOString(),
    });
    result = synced ? "saved=notion" : "saved=local";
  } catch (e) {
    result = `notionError=${encodeURIComponent((e instanceof Error ? e.message : String(e)).slice(0, 300))}`;
  }
  revalidatePath("/templates");
  redirect(`/templates?${result}&slot=${encodeURIComponent(key)}#${encodeURIComponent(key)}`);
}

export async function removeTemplateAction(formData: FormData) {
  await removeTemplateFile(String(formData.get("key")));
  revalidatePath("/templates");
}

export async function disconnectNotionAction() {
  await disconnectNotion();
  revalidatePath("/");
}
