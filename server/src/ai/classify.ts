/**
 * Ticket classification entry point.
 *
 * Slice 3 replaces this stub with the full AI service: an LLM provider
 * (bake-off winner) with a deterministic fallback engine behind the same
 * interface. The contract stays: this function never throws to the caller
 * and never blocks ticket creation — it patches category/priority onto the
 * ticket when it can.
 */
export async function classifyTicket(_ticketId: string): Promise<void> {
  // Implemented in Slice 3.
}
