export interface Book {
  id: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  status: string;
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastRoyaltyPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
}

export interface BooksResponse {
  books: Book[];
  summary: {
    bookCount: number;
    totalCopiesSold: number;
    totalRoyaltyEarned: number;
    royaltyPaid: number;
    royaltyPending: number;
  };
}

export interface TicketMessage {
  id: string;
  senderRole: "AUTHOR" | "ADMIN";
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  authorId: string;
  bookId: string | null;
  book?: Book | null;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  category: string | null;
  categorySource: string | null;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  prioritySource: string | null;
  assignedToId: string | null;
  aiDraft?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface SessionUser {
  id: string;
  email: string;
  role: "AUTHOR" | "ADMIN";
  authorId: string | null;
}

const TOKEN_KEY = "bookleaf_token";
const USER_KEY = "bookleaf_user";

export function getSession(): { token: string; user: SessionUser } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return { token, user: JSON.parse(raw) as SessionUser };
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.error as { code?: string; message?: string } | undefined) ?? {};
    throw new ApiFailure(res.status, err.code ?? "ERROR", err.message ?? "Something went wrong");
  }
  return data as T;
}

export function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
