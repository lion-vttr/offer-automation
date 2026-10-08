import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { derive, type Offer } from "@/lib/offer";
import { fillDocx, tokenValues } from "@/lib/templating";

// Smallest valid .docx: one paragraph of text.
function docx(text: string): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}

const text = (buf: Buffer) => new PizZip(buf).file("word/document.xml")!.asText().replace(/<[^>]+>/g, "");

const offer: Offer = {
  id: "o1",
  status: "Approved",
  created_at: "2026-10-08T00:00:00Z",
  notion_url: null,
  ashby_candidate_id: "c1",
  candidate_name: "Alex Example",
  personal_email: "alex@example.com",
  job_title_contract: "Research Scientist",
  manager: "Riley Manager",
  work_location: "Berlin",
  legal_entity: "Prior Labs GmbH",
  contract_type: "Indefinite",
  start_date: "2026-11-02",
  end_date: "",
  hours_per_week: 40,
  base_salary_annual: 100000,
  rsu_total: 240000,
  relocation_amount: null,
  rationale: "",
  candidate_expectation: "",
  candidate_details: null,
  ...derive({ legal_entity: "Prior Labs GmbH", base_salary_annual: 100000, rsu_total: 240000 }),
};

describe("fillDocx", () => {
  it("fills placeholders with formatted values", () => {
    const { doc, missing } = fillDocx(
      docx("Dear {{first_name}}, you start on {{start_date}} at {{base_salary_monthly_gross}} per month."),
      tokenValues(offer, "MD Name"),
    );
    expect(text(doc)).toBe("Dear Alex, you start on 2 November 2026 at EUR 8.333,33 per month.");
    expect(missing).toEqual([]);
  });

  it("marks values that are still missing", () => {
    const { doc, missing } = fillDocx(docx("{{legal_full_name}}, {{city}}; {{end_date}}"), tokenValues(offer, ""));
    expect(missing).toEqual(["legal_full_name", "city"]);
    expect(text(doc)).toBe("[[MISSING: legal_full_name]], [[MISSING: city]]; ");
  });
});
