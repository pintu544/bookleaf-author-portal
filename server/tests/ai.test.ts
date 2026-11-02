import { describe, expect, it } from "vitest";
import { classifyFallback, draftFallback } from "../src/ai/fallback";
import { parseClassification } from "../src/ai/llm";

/**
 * The seven sample scenarios from the assignment brief itself. The fallback
 * engine must get these right with no LLM available — they are the exact
 * cases BookLeaf will demo against.
 */
const SAMPLES: { subject: string; body: string; category: string; priority?: string }[] = [
  {
    subject: "Royalty not received",
    body: "I published my book 6 months ago and have sold over 300 copies, but I haven't received any royalty payment yet. What is going on?",
    category: "Royalty & Payments",
    priority: "CRITICAL",
  },
  {
    subject: "Royalty amount seems wrong",
    body: "My royalty for Q2 was 1200 rupees but I calculated it should be around 2100 based on my book's MRP of 499 rupees and 89 copies sold. Can you recheck?",
    category: "Royalty & Payments",
  },
  {
    subject: "Wrong ISBN on Amazon listing",
    body: "The ISBN shown on my Amazon listing is wrong — it shows 978-93-XXXXX-99-9 but my actual ISBN is 978-93-5XXXX-07-3. My author name is also spelled incorrectly.",
    category: "ISBN & Metadata Issues",
    priority: "HIGH",
  },
  {
    subject: "Printed copies are blurry",
    body: "I ordered 10 author copies and the print quality is terrible. The text on several pages is blurry and 2 pages are completely misaligned. This is embarrassing.",
    category: "Printing & Quality",
  },
  {
    subject: "Book showing unavailable on Flipkart",
    body: "My book has been published for 3 weeks now but on Flipkart it shows 'currently unavailable'. On Amazon India it is available fine. Why is Flipkart not selling it?",
    category: "Distribution & Availability",
  },
  {
    subject: "Book stuck in production",
    body: "My book has been in 'Cover Design' stage for 3 weeks now. What is causing the delay and when will it move to the next stage?",
    category: "Book Status & Production Updates",
  },
  {
    subject: "How to update my author bio",
    body: "I want to update my author bio and profile photo on Amazon. How do I do this? Also, can I change my pen name for future books?",
    category: "General Inquiry",
    priority: "LOW",
  },
];

describe("fallback classification on the brief's own samples", () => {
  for (const sample of SAMPLES) {
    it(`classifies "${sample.subject}"`, () => {
      const result = classifyFallback(sample.subject, sample.body);
      expect(result.category).toBe(sample.category);
      if (sample.priority) expect(result.priority).toBe(sample.priority);
    });
  }
});

describe("fallback drafts", () => {
  it("grounds a royalty draft in the author's real figures and the payout policy", () => {
    const draft = draftFallback("Royalty & Payments", {
      authorName: "Priya Sharma",
      bookTitle: "Whispers of the Ganges",
      bookStatus: "Published & Live",
      royaltyPending: 3570,
      royaltyPaid: 8400,
      lastPayoutDate: "15 Oct 2025",
    });
    expect(draft).toContain("Dear Priya,");
    expect(draft).toContain("₹3,570");
    expect(draft).toContain("45 days");
    expect(draft).toContain("₹1,000");
    expect(draft).toContain("Team BookLeaf");
  });

  it("asks for photos on a print-quality draft", () => {
    const draft = draftFallback("Printing & Quality", {
      authorName: "Amit Verma",
      bookTitle: "The Last Train to Kanpur",
      bookStatus: "Published & Live",
      royaltyPending: 0,
      royaltyPaid: 0,
      lastPayoutDate: null,
    });
    expect(draft.toLowerCase()).toContain("photo");
    expect(draft.toLowerCase()).toContain("free reprint");
  });
});

describe("LLM classification parsing", () => {
  it("accepts strict JSON in the taxonomy", () => {
    expect(parseClassification('{"category":"Royalty & Payments","priority":"HIGH"}')).toEqual({
      category: "Royalty & Payments",
      priority: "HIGH",
    });
  });
  it("tolerates prose around the JSON", () => {
    expect(
      parseClassification('Here is the result: {"category":"General Inquiry","priority":"LOW"} — done').category,
    ).toBe("General Inquiry");
  });
  it("rejects off-taxonomy output so the caller falls back", () => {
    expect(() => parseClassification('{"category":"Billing","priority":"HIGH"}')).toThrow();
    expect(() => parseClassification("no json here")).toThrow();
  });
});
