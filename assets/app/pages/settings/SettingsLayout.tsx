import { NavLink, Outlet } from "react-router";
import { settingsNav } from "../../lib/nav";
import { hasRole, useAuth } from "../../lib/auth";

/**
 * The Settings hub.
 *
 * Settings used to be four sidebar entries — Workers, Company, Integrations,
 * Account — which put "our billing address" and "my phone number" at the same
 * level as Drivers and Loads, and left no obvious home for anything new. One
 * sidebar entry opens a rail instead, so the sidebar stays about the fleet and
 * configuration is one place you go.
 *
 * The rail hides what you cannot open, matching the sidebar's own filtering;
 * the routes in App.tsx are what actually enforce it.
 */
export default function SettingsLayout() {
  const { user } = useAuth();
  const items = settingsNav.filter(item => !item.roles || hasRole(user, item.roles));

  return (
    <div className="flex flex-col lg:flex-row gap-4 max-w-5xl">
      <nav
        aria-label="Settings"
        className="lg:w-48 flex-shrink-0 lg:sticky lg:top-0 lg:self-start bg-card border border-border rounded-lg p-1.5"
      >
        {/* Horizontal strip when the rail cannot sit beside the content. */}
        <div className="flex lg:flex-col gap-0.5 overflow-x-auto scroll-thin">
          {items.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <item.icon size={13} className="flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <Outlet />
      </div>
    </div>
  );
}
