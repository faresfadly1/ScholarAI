"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  UserRound,
  Files,
  GraduationCap,
  ChartNoAxesCombined,
  Columns3,
  Route,
  Settings2,
  ShieldCheck,
  Search,
  Menu,
  X,
  LogOut,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Auth } from "@/types";
import { initials } from "@/lib/utils";
import { ErrorState, Loading } from "./ui/common";
const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/profile", label: "My profile", icon: UserRound },
  { href: "/documents", label: "Documents", icon: Files },
  { href: "/scholarships", label: "Scholarships", icon: GraduationCap },
  { href: "/analyses", label: "My analyses", icon: ChartNoAxesCombined },
  { href: "/compare", label: "Compare", icon: Columns3 },
  { href: "/roadmap", label: "Application roadmap", icon: Route },
];
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? "logo-light" : ""}`}>
      <span className="logo-mark">
        <GraduationCap size={23} />
      </span>
      Scholar<span className="logo-ai">AI</span>
    </span>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    router = useRouter(),
    client = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<Auth>("/auth/me"),
    retry: false,
  });
  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) router.replace("/login");
  }, [session.error, router]);
  if (session.isLoading) return <Loading />;
  if (session.error) return <ErrorState error={session.error} retry={() => session.refetch()} />;
  if (!session.data) return null;
  const user = session.data.user;
  const active =
    nav.find((n) => path.startsWith(n.href))?.label ||
    (path.startsWith("/analysis")
      ? "Application analysis"
      : path.startsWith("/admin")
        ? "Admin review"
        : "Settings");
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Link href="/dashboard" aria-label="ScholarAI overview">
            <Logo />
          </Link>
          <button
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">{initials(user.name).slice(0, 1)}</span>
          <div>
            <strong>My workspace</strong>
            <span>Personal account</span>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <Link
              onClick={() => setMenu(false)}
              key={n.href}
              href={n.href}
              className={`nav-item ${path.startsWith(n.href) || (n.href === "/analyses" && path.startsWith("/analysis/")) ? "active" : ""}`}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.href === "/analyses" && <span className="nav-new">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Sparkles size={17} />
            </span>
            <strong>A clearer path forward.</strong>
            <p>Every requirement. Every piece of evidence. One application plan.</p>
            <Link href="/scholarships/new">
              Analyze an application <span>+</span>
            </Link>
          </div>
          <Link className={`nav-item ${path === "/settings" ? "active" : ""}`} href="/settings">
            <Settings2 size={18} />
            Settings
          </Link>
          {user.role === "admin" && (
            <Link className="nav-item" href="/admin">
              <ShieldCheck size={18} />
              Admin review
            </Link>
          )}
          <div className="user-card">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>Student workspace</span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await api("/auth/logout", { method: "POST" });
                client.clear();
                router.push("/login");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span className="muted">Workspace</span>
            <span className="muted">/</span>
            <strong>{active}</strong>
          </div>
          <div className="topbar-right">
            <form
              className="search-box"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/scholarships?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a scholarship…"
                aria-label="Find a scholarship"
              />
              <kbd>↵</kbd>
            </form>
            <Link href="/profile" className="avatar small" aria-label="View profile">
              {initials(user.name)}
            </Link>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="app-footer">
          <span>ScholarAI · Built around your evidence.</span>
          <span>
            <ShieldCheck size={13} /> Your documents stay private
          </span>
        </footer>
      </div>
    </div>
  );
}
