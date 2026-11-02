import type { Response } from "express";

/**
 * Tiny in-process Server-Sent Events hub.
 *
 * One channel per audience that cares about a ticket:
 *  - `author:<authorId>`  — the ticket's author
 *  - `admins`             — every signed-in admin (queue refreshes)
 *
 * Events: `ticket-created`, `ticket-updated`, `message-added`.
 * Clients that cannot hold an SSE connection still poll (the client polls
 * as a baseline), so SSE is an enhancement, never a single point of failure.
 * A multi-instance deployment would swap this hub for Redis pub/sub behind
 * the same publish/subscribe calls.
 */
type Listener = (event: string, data: unknown) => void;

const channels = new Map<string, Set<Listener>>();

export function subscribe(channel: string, listener: Listener): () => void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) channels.delete(channel);
  };
}

export function publish(channel: string, event: string, data: unknown): void {
  const set = channels.get(channel);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event, data);
    } catch {
      // A dead client must never break publishing for everyone else.
    }
  }
}

export function publishTicketEvent(event: string, authorId: string, payload: unknown): void {
  publish(`author:${authorId}`, event, payload);
  publish("admins", event, payload);
}

/** Attach an SSE stream to an Express response on the given channel. */
export function openStream(res: Response, channel: string): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");
  const unsubscribe = subscribe(channel, (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
  res.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}
