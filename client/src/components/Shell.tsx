import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getSession } from "../api";

export function statusStyle(status: string): string {
  switch (status) {
    case "OPEN":
      return "bg-clay/10 text-clay";
    case "IN_PROGRESS":
      return "bg-gold/15 text-gold";
    case "RESOLVED":
      return "bg-leaf/10 text-leaf";
    default:
      return "bg-ink/10 text-ink-soft";
  }
}

export function statusLabel(status: string): string {
  return status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function priorityStyle(priority: string | null): string {
  switch (priority) {
    case "CRITICAL":
      return "bg-red-700 text-white";
    case "HIGH":
      return "bg-clay text-white";
    case "MEDIUM":
      return "bg-gold/20 text-gold";
    case "LOW":
      return "bg-ink/10 text-ink-soft";
    default:
      return "bg-ink/5 text-ink-soft";
  }
}

export function Shell() {
  const session = getSession();
  const navigate = useNavigate();
  if (!session) return <Navigate to="/login" replace />;
  const isAdmin = session.user.role === "ADMIN";

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-leaf text-white" : "text-ink-soft hover:bg-paper-deep hover:text-ink"}`;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="font-display text-xl font-semibold tracking-tight text-leaf-deep">
              BookLeaf <span className="font-normal text-ink-soft">Author Support</span>
            </span>
            <nav className="hidden items-center gap-1 sm:flex">
              {isAdmin ? (
                <NavLink to="/admin" end className={linkCls}>
                  Ticket Queue
                </NavLink>
              ) : (
                <>
                  <NavLink to="/books" className={linkCls}>
                    My Books
                  </NavLink>
                  <NavLink to="/tickets" className={linkCls}>
                    My Tickets
                  </NavLink>
                  <NavLink to="/tickets/new" className={linkCls}>
                    Submit a Query
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft md:block">{session.user.email}</span>
            <button
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-paper-deep"
              onClick={() => {
                clearSession();
                navigate("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 px-4 pb-3 sm:hidden">
          {isAdmin ? (
            <NavLink to="/admin" end className={linkCls}>
              Ticket Queue
            </NavLink>
          ) : (
            <>
              <NavLink to="/books" className={linkCls}>
                My Books
              </NavLink>
              <NavLink to="/tickets" className={linkCls}>
                My Tickets
              </NavLink>
              <NavLink to="/tickets/new" className={linkCls}>
                Submit a Query
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
