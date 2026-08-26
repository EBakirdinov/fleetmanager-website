import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Truck, Route, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { navSections } from "../lib/nav";
import { useAuth } from "../lib/auth";

function initialsOf(user: { firstName?: string | null; lastName?: string | null; email?: string } | null): string {
  if (!user) return "?";
  const f = (user.firstName ?? "").trim();
  const l = (user.lastName ?? "").trim();
  if (f || l) return (f.slice(0, 1) + l.slice(0, 1)).toUpperCase() || "?";
  const e = (user.email ?? "").trim();
  return e ? e.slice(0, 2).toUpperCase() : "?";
}

function displayName(user: { firstName?: string | null; lastName?: string | null; email?: string } | null): string {
  if (!user) return "Signed out";
  const name = [(user.firstName ?? "").trim(), (user.lastName ?? "").trim()].filter(Boolean).join(" ");
  return name || user.email || "Signed in";
}

function roleLabel(roles: string[] | undefined): string {
  if (!roles || roles.length === 0) return "Member";
  if (roles.includes("ROLE_OWNER")) return "Owner";
  if (roles.includes("ROLE_MANAGER")) return "Manager";
  if (roles.includes("ROLE_DISPATCHER")) return "Dispatcher";
  return "Member";
}

function getStoredOpen(): boolean {
  try { return localStorage.getItem("sidebar_open") !== "false"; } catch { return true; }
}

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(getStoredOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem("sidebar_open", String(next)); } catch { /* ignore */ }
  }

  return (
    <aside
      className="flex-shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200"
      style={{ width: open ? 208 : 56 }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center border-b border-sidebar-border h-[52px] px-3 flex-shrink-0">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
          <Truck size={13} className="text-primary-foreground" />
        </div>
        {open && (
          <div className="ml-2.5 flex-1 min-w-0">
            <p className="text-sm font-bold text-white tracking-tight leading-none">Fleet Pro</p>
            <p className="text-[9px] font-mono text-sidebar-foreground/50 tracking-widest uppercase">Operations</p>
          </div>
        )}
        <button
          onClick={toggle}
          className="ml-auto p-1 rounded text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
          title={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          {open ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map(section => (
          <div key={section.label}>
            {open && (
              <p className="text-[9px] font-mono text-sidebar-foreground/40 tracking-widest uppercase px-3 mb-1">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.filter(item =>
                (item.path !== "/company" && item.path !== "/integrations") || user?.roles?.includes("ROLE_OWNER")
              ).map(({ icon: Icon, label, path, badge }) => (
                <NavLink
                  key={path}
                  to={path}
                  title={!open ? label : undefined}
                  className={({ isActive }) =>
                    `w-full flex items-center rounded-md transition-colors text-left
                    ${open ? "gap-2.5 px-3 py-2" : "justify-center py-2.5"}
                    ${isActive
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`
                  }
                >
                  <Icon size={15} className="flex-shrink-0" />
                  {open && <span className="font-medium text-sm truncate">{label}</span>}
                  {open && badge && (
                    <span className="ml-auto text-[10px] font-mono bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* IFTA quick action */}
        {/* {open && (
          <div className="pt-1 border-t border-sidebar-border">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <Route size={15} />
              <span className="font-medium text-sm">IFTA Trip</span>
              <span className="ml-auto text-[9px] font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded">NEW</span>
            </button>
          </div>
        )} */}
      </nav>

      {/* Bottom: user card */}
      <div className="border-t border-sidebar-border">
        <div className="p-2">
          {open ? (
            <button
              onClick={() => navigate("/account")}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md hover:bg-sidebar-accent transition-colors text-left group"
            >
              <div className="w-7 h-7 rounded-full bg-primary/25 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-primary">{initialsOf(user)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">{displayName(user)}</p>
                <p className="text-[10px] font-mono text-sidebar-foreground/60">{roleLabel(user?.roles)}</p>
              </div>
              <Settings size={12} className="text-sidebar-foreground/40 group-hover:text-sidebar-foreground transition-colors flex-shrink-0" />
            </button>
          ) : (
            <button
              onClick={() => navigate("/account")}
              title="Account"
              className="w-full flex justify-center py-2 rounded-md hover:bg-sidebar-accent transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-primary/25 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">{initialsOf(user)}</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
