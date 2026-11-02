import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { getSession } from "./api";
import { Shell } from "./components/Shell";
import Login from "./pages/Login";
import AuthorBooks from "./pages/AuthorBooks";
import AuthorTickets from "./pages/AuthorTickets";
import AuthorTicketDetail from "./pages/AuthorTicketDetail";
import SubmitTicket from "./pages/SubmitTicket";
import AdminQueue from "./pages/AdminQueue";
import AdminTicketDetail from "./pages/AdminTicketDetail";
import "./index.css";

function HomeRedirect() {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={session.user.role === "ADMIN" ? "/admin" : "/books"} replace />;
}

const router = createBrowserRouter([
  { path: "/", element: <HomeRedirect /> },
  { path: "/login", element: <Login /> },
  {
    element: <Shell />,
    children: [
      { path: "/books", element: <AuthorBooks /> },
      { path: "/tickets", element: <AuthorTickets /> },
      { path: "/tickets/new", element: <SubmitTicket /> },
      { path: "/tickets/:id", element: <AuthorTicketDetail /> },
      { path: "/admin", element: <AdminQueue /> },
      { path: "/admin/tickets/:id", element: <AdminTicketDetail /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
