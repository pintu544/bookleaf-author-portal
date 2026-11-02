import { CATEGORIES, PRIORITIES, type Category, type Priority } from "../lib/types";
import { knowledgeBaseText } from "./knowledgeBase";

/**
 * LLM provider access — OpenAI-compatible chat completions, configured
 * purely through environment variables:
 *   AI_API_KEY    (server-side only, never sent to the client)
 *   AI_BASE_URL   e.g. the provider's /v1 root
 *   AI_MODEL      e.g. the bake-off winning model id
 * Any provider exposing the OpenAI shape works (direct OpenAI, Vercel AI
 * Gateway, FastRouter, ...). The bake-off in the project workspace chose
 * the default pairing; the choice is config, not code.
 *
 * Every call has a hard timeout and fails closed: callers fall back to the
 * deterministic engine, so an LLM outage never breaks the portal.
 */

export interface AiClassification {
  category: Category;
  priority: Priority;
}

const TIMEOUT_MS = 12_000;

export function llmConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL);
}

async function chatCompletion(system: string, user: string, maxTokens: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${process.env.AI_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM responded ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("LLM returned an empty completion");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract and validate a classification object, refusing anything off-taxonomy. */
export function parseClassification(raw: string): AiClassification {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in classification");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as { category?: string; priority?: string };
  const category = CATEGORIES.find((c) => c === parsed.category);
  const priority = PRIORITIES.find((p) => p === parsed.priority);
  if (!category || !priority) throw new Error("Classification fell outside the taxonomy");
  return { category, priority };
}

export async function classifyWithLlm(subject: string, body: string): Promise<AiClassification> {
  const system = [
    "You triage support tickets for BookLeaf Publishing, a self-publishing company.",
    `Classify the ticket into exactly one category from: ${CATEGORIES.join("; ")}.`,
    `Assign exactly one priority from: ${PRIORITIES.join(", ")}.`,
    "Priority criteria — CRITICAL: no royalty received for 6+ months, wrong book delivered to all customers, legal threats. HIGH: ISBN errors (they hurt discoverability), royalty unpaid for months, bulk print defects. MEDIUM: book unavailable on a store, print delay, wrong metadata. LOW: general questions, bio or profile updates, minor issues.",
    'Respond with JSON only: {"category": "...", "priority": "..."}. No other text.',
  ].join("\n");
  const raw = await chatCompletion(system, `Subject: ${subject}\n\n${body}`, 120);
  return parseClassification(raw);
}

export async function draftWithLlm(input: {
  subject: string;
  body: string;
  authorName: string;
  bookFacts: string;
}): Promise<string> {
  const system = [
    "You draft support replies for BookLeaf Publishing. The admin will review and edit your draft before sending, so write it ready to send.",
    "Ground every policy statement in this Knowledge Base and nowhere else:",
    knowledgeBaseText(),
    "Rules: address the author by first name; acknowledge the concern first; use the author's real figures from the context when relevant; never invent amounts, dates or statuses that are not in the context; give a timeline for any escalation; end with one clear next step; sign off as Team BookLeaf. Plain text, no markdown.",
  ].join("\n");
  const user = [
    `Author: ${input.authorName}`,
    `Context from the author's record: ${input.bookFacts}`,
    `Ticket subject: ${input.subject}`,
    `Ticket message: ${input.body}`,
  ].join("\n");
  return chatCompletion(system, user, 600);
}
