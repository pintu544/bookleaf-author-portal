import { createApp } from "./app";
import { classifyTicket } from "./ai/classify";
import { prisma } from "./lib/prisma";

const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => {
  console.log(`BookLeaf API listening on :${port}`);
  // Classification is fire-and-forget when a ticket is created, so a
  // restart mid-flight would leave that ticket unclassified forever.
  // Sweep up any stragglers once on boot; the classifier's own guards
  // make this safe to run alongside live traffic.
  void (async () => {
    const pending = await prisma.ticket.findMany({
      where: { category: null },
      select: { id: true },
      take: 100,
    });
    for (const ticket of pending) void classifyTicket(ticket.id);
  })().catch((err) => console.error("Classification sweep failed", err));
});
