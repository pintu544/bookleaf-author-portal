import { CATEGORIES, PRIORITIES, type Category, type Priority } from "../lib/types";
import { KB } from "./knowledgeBase";

/**
 * Deterministic fallback engine.
 *
 * If the LLM provider is unconfigured, down, slow or rate-limited, this
 * engine still classifies, prioritises and drafts — the portal never has a
 * dead AI button. It is deliberately conservative: keyword evidence for
 * category, explicit escalation rules for priority (mirroring the brief's
 * criteria), and template drafts assembled from the Knowledge Base plus the
 * author's real figures from the database.
 */

export interface Classification {
  category: Category;
  priority: Priority;
}

const CATEGORY_SIGNALS: { category: Category; patterns: RegExp[] }[] = [
  {
    category: "Royalty & Payments",
    patterns: [/royalt/i, /payment/i, /paid/i, /payout/i, /earnings/i, /₹|rs\.?\s?\d|rupees/i, /bank transfer/i],
  },
  {
    category: "ISBN & Metadata Issues",
    patterns: [/isbn/i, /wrong title/i, /author name (is )?(wrong|incorrect)/i, /metadata/i, /bio (is |shows )?(wrong|incorrect|outdated)/i, /description (is )?(wrong|incorrect)/i, /listing (shows|says)/i],
  },
  {
    category: "Printing & Quality",
    patterns: [/blurry/i, /print/i, /pages? (are )?(misaligned|missing|torn|damaged)/i, /damaged/i, /quality/i, /defective/i, /binding/i, /copy (arrived|came)/i],
  },
  {
    category: "Distribution & Availability",
    patterns: [/amazon/i, /flipkart/i, /unavailable/i, /out of stock/i, /not (available|listed|showing)/i, /deliver/i, /store/i, /buy/i],
  },
  {
    category: "Book Status & Production Updates",
    patterns: [/status/i, /production/i, /cover design/i, /typesetting/i, /proofread/i, /editing/i, /when will (my|the) book/i, /published/i, /delay/i],
  },
];

export function classifyFallback(subject: string, body: string): Classification {
  const text = `${subject}\n${body}`;
  let best: Category = "General Inquiry";
  let bestScore = 0;
  for (const { category, patterns } of CATEGORY_SIGNALS) {
    const score = patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }
  // How-to / process questions with no error, defect or payment signal are
  // general inquiries, even when they mention a platform or a profile field
  // (the brief's own bio-update sample is the canonical case).
  if (bestScore <= 1 && /\bhow (do|can|to)\b|\bcan i\b/i.test(text)) {
    best = "General Inquiry";
  }
  return { category: best, priority: prioritiseFallback(best, text) };
}

function prioritiseFallback(category: Category, text: string): Priority {
  const t = text.toLowerCase();
  // Critical signals come straight from the brief's priority criteria:
  // no royalty for 6+ months, wrong book delivered at scale, legal threats.
  if (/legal|lawyer|court|consumer forum/.test(t)) return "CRITICAL";
  if (/wrong book (delivered|sent|received)/.test(t) && /(all|every|customers|orders)/.test(t)) return "CRITICAL";
  if (/royalt|payment|paid/.test(t) && /(six months|6 months|two quarters|never received|not received (any|a single))/.test(t))
    return "CRITICAL";
  // High: ISBN errors are escalated immediately per policy; long-unpaid
  // royalties and bulk print defects also rate high.
  if (category === "ISBN & Metadata Issues" && /isbn/.test(t)) return "HIGH";
  if (/royalt|payment/.test(t) && /(months|quarter|long time|still (not|haven't|hasn't))/.test(t)) return "HIGH";
  if (/(all|every|bulk|multiple) (copies|books)/.test(t) && /damag|defect|blurry|misalign/.test(t)) return "HIGH";
  if (category === "Printing & Quality" || category === "Distribution & Availability") return "MEDIUM";
  if (category === "Royalty & Payments" || category === "Book Status & Production Updates") return "MEDIUM";
  return "LOW";
}

export interface DraftContext {
  authorName: string;
  bookTitle: string | null;
  bookStatus: string | null;
  royaltyPending: number | null;
  royaltyPaid: number | null;
  lastPayoutDate: string | null;
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

/**
 * Template draft builder: empathetic opener, the specific fact from the
 * author's own record, the relevant policy line, a timeline, and a clear
 * next step — the same shape the brief's gold-standard samples use.
 */
export function draftFallback(category: Category, ctx: DraftContext): string {
  const first = ctx.authorName.split(" ")[0];
  const lines: string[] = [`Dear ${first},`];
  switch (category) {
    case "Royalty & Payments": {
      lines.push(
        "",
        "Thank you for writing to us, and I am sorry for the worry this has caused. I have checked your royalty account" +
          (ctx.bookTitle ? ` for "${ctx.bookTitle}"` : "") +
          " carefully.",
      );
      if (ctx.royaltyPending != null) {
        lines.push(
          `Your accumulated royalty currently stands at ${inr(ctx.royaltyPending)} pending` +
            (ctx.royaltyPaid != null ? `, with ${inr(ctx.royaltyPaid)} already paid to you` : "") +
            (ctx.lastPayoutDate ? ` (last payout on ${ctx.lastPayoutDate})` : "") +
            ".",
        );
      }
      lines.push(
        `${KB.royalty}`,
        "I have flagged your account to our accounts team for a line-by-line verification, and I will personally update you on this ticket within 2 working days with the exact amount and the payout date. If anything in the statement does not match your records, reply here and we will reconcile it together.",
      );
      break;
    }
    case "ISBN & Metadata Issues": {
      lines.push(
        "",
        "Thank you for flagging this, and I am sorry about the error. Details like the ISBN, title and author name feed directly into your book's discoverability and sales reporting, so we treat this as a priority.",
        `${KB.isbn}`,
        "I have escalated this to our production team for correction. Metadata fixes usually reflect on retailer listings within 3–5 working days after the corrected file is pushed. I will confirm on this ticket as soon as the correction is live, and if you can share a screenshot of where you saw the error, it will help the team verify the fix end to end.",
      );
      break;
    }
    case "Printing & Quality": {
      lines.push(
        "",
        "I am sorry your copy did not come out as it should have — that is on us, and we will make it right.",
        `${KB.printing}`,
        "Could you please share 2–3 photos of the defective pages (including the cover and the copyright page) in reply to this ticket? As soon as we verify them, we will dispatch a free reprint and update you with the tracking details here.",
      );
      break;
    }
    case "Distribution & Availability": {
      lines.push(
        "",
        "Thank you for letting us know — I understand it is frustrating to send readers to a page that does not let them buy the book.",
        `${KB.distribution}`,
        "I have raised a re-sync request for your listings today. Please give it 24–48 hours to reflect, and I will check the links myself and confirm on this ticket once your book is buyable again on every platform.",
      );
      break;
    }
    case "Book Status & Production Updates": {
      lines.push(
        "",
        "Thank you for checking in — here is exactly where your book stands.",
      );
      if (ctx.bookStatus) {
        lines.push(`Your book is currently at the "${ctx.bookStatus}" stage. ${KB.production}`);
      } else {
        lines.push(`${KB.production}`);
      }
      lines.push(
        "I have asked the production team for the current expected date for the next stage, and I will update you on this ticket within 2 working days. If a stage is waiting on your approval (for example, the cover design), approving it in reply here is the fastest way to keep the book moving.",
      );
      break;
    }
    default: {
      lines.push(
        "",
        "Thank you for writing to us. I have noted the details you shared, and I am looking into this with the relevant team.",
        "I will update you on this ticket within 2 working days with a specific answer and the next step. If anything changes in the meantime, just reply here — your message will reach me directly on this thread.",
      );
    }
  }
  lines.push("", "Warm regards,", "Team BookLeaf");
  return lines.join("\n");
}

export { CATEGORIES, PRIORITIES };
