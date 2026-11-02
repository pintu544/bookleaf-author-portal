/**
 * The BookLeaf Knowledge Base, distilled from the assignment brief.
 * This is the single grounding source for both the LLM prompts and the
 * deterministic fallback drafter — the two paths can never drift apart on
 * policy facts because they read the same constants.
 */
export const KB = {
  company:
    "BookLeaf Publishing is a self-publishing company operating in India and the US. Packages: Standard (Free) and Bestseller Breakthrough. Printing and warehousing are in-house in Delhi, with partners Repro India and Epitome Books.",
  royalty:
    "Royalty split is 80/20 (author/BookLeaf) on net profit per copy, where net profit = MRP minus printing cost, platform commission and shipping charges. Royalties are calculated quarterly and paid within 45 days of the quarter end. The minimum payout threshold is ₹1,000; balances below ₹1,000 roll over to the next cycle. Payouts are made by bank transfer.",
  isbn: "ISBN is assigned by BookLeaf under the BookLeaf imprint. ISBN errors affect discoverability and sales reporting, so they are treated as high priority and escalated to the production team immediately.",
  printing:
    "Standard print turnaround after print-ready files are approved is 5–7 business days. For print quality issues (blurry text, misaligned pages, damaged delivery), BookLeaf provides a free reprint after verification; the author may be asked to share photos of the defective copy.",
  distribution:
    "Books are distributed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store. Listings go live within 7–10 business days after publication. A book showing unavailable is usually a stock sync issue; re-sync is done within 24–48 hours.",
  production:
    "Production stages: Manuscript Received → Editing → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live. The stages where delays are most common are Cover Design (waiting on author approval) and Proofreading (revision rounds).",
  tone: "Empathetic and professional. Authors are partners. Acknowledge the concern first, be specific (numbers, dates, statuses), own BookLeaf's part directly where applicable, give timelines for any escalation or investigation, and end with a clear next step.",
} as const;

/** Full KB text for LLM system prompts. */
export function knowledgeBaseText(): string {
  return [
    `Company: ${KB.company}`,
    `Royalties: ${KB.royalty}`,
    `ISBN: ${KB.isbn}`,
    `Printing & quality: ${KB.printing}`,
    `Distribution: ${KB.distribution}`,
    `Production: ${KB.production}`,
    `Tone: ${KB.tone}`,
  ].join("\n");
}
