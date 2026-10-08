import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { TEMPLATE_DIR, getOffer, listTemplates, slotFor, type TemplateKind } from "@/lib/store";
import { fillDocx, tokenValues } from "@/lib/templating";

// GET /api/offers/:id/document?kind=offer_letter|contract → filled .docx
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind") as TemplateKind;
  if (kind !== "offer_letter" && kind !== "contract") {
    return NextResponse.json({ error: "kind must be offer_letter or contract" }, { status: 400 });
  }
  const offer = await getOffer(id);
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

  const slot = slotFor(kind, offer);
  const entry = (await listTemplates())[slot.key];
  if (!entry?.filename) {
    return NextResponse.json({ error: `No template uploaded for "${slot.label}". Add it on the Templates page.` }, { status: 404 });
  }

  const template = await fs.readFile(path.join(TEMPLATE_DIR, entry.filename));
  let result;
  try {
    result = fillDocx(template, tokenValues(offer, entry.md_signatory));
  } catch (e) {
    // docxtemplater reports broken placeholders (e.g. "{{start_date" without closing braces).
    const detail = (e as { properties?: { errors?: { properties?: { explanation?: string } }[] } }).properties?.errors
      ?.map((x) => x.properties?.explanation)
      .join("; ");
    return NextResponse.json({ error: `Template could not be filled: ${detail || String(e)}` }, { status: 422 });
  }

  const name = `${kind === "offer_letter" ? "Offer letter" : "Contract"} - ${offer.candidate_name}.docx`;
  return new NextResponse(new Uint8Array(result.doc), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Missing-Fields": result.missing.join(","),
    },
  });
}
