import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiFailure, setSession, type SessionUser } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(res.token, res.user);
      navigate(res.user.role === "ADMIN" ? "/admin" : "/books", { replace: true });
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : "Could not log in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-leaf-deep">BookLeaf Author Support</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Check your books and royalties, raise a query, and hear back from the BookLeaf team — all in one place.
        </p>
        <form onSubmit={submit} className="mt-6 rounded-xl border border-line bg-card p-6 shadow-[0_2px_12px_rgba(35,32,27,0.06)]">
          <label className="block text-sm font-medium" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-[15px]"
            placeholder="you@example.com"
          />
          <label className="mt-4 block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-[15px]"
          />
          {error && (
            <p role="alert" className="mt-4 rounded-md bg-clay/10 px-3 py-2 text-sm text-clay">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-md bg-leaf px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-leaf-deep disabled:opacity-60"
          >
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          New queries are answered by the BookLeaf support team, usually within two working days.
        </p>
      </div>
    </div>
  );
}
