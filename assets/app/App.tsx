import { createBrowserRouter, RouterProvider, Navigate } from "react-router";
import AppShell from "./shell/AppShell";
import { RequireAuth, RequireRole } from "./lib/auth";
import { WORKER_ADMIN_ROLES } from "./lib/roles";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Trucks from "./pages/Trucks";
import Trailers from "./pages/Trailers";
import Drivers from "./pages/Drivers";
import Loads from "./pages/Loads";
import LoadAdd from "./pages/LoadAdd";
import LoadEdit from "./pages/LoadEdit";
import Fuel from "./pages/Fuel";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Integrations from "./pages/Integrations";
import Workers from "./pages/Workers";
import SettingsLayout from "./pages/settings/SettingsLayout";
import AccountSettings from "./pages/settings/AccountSettings";
import SecuritySettings from "./pages/settings/SecuritySettings";
import CompanySettings from "./pages/settings/CompanySettings";
import BillingSettings from "./pages/settings/BillingSettings";

const OWNER_ONLY = ["ROLE_OWNER"];

const router = createBrowserRouter([
  { path: "/login",    Component: Login    },
  { path: "/register", Component: Register },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", Component: Dashboard },
      { path: "trucks",    Component: Trucks    },
      { path: "trailers",  Component: Trailers  },
      { path: "drivers",   Component: Drivers   },
      { path: "loads",     Component: Loads     },
      { path: "loads/new", Component: LoadAdd   },
      { path: "loads/:id", Component: LoadEdit  },
      { path: "fuel",      Component: Fuel      },
      { path: "reports",   Component: Reports   },
      { path: "documents", Component: Documents },

      // Every settings destination lives under one hub, and every one of them
      // is guarded at the route rather than inside the page — Company used to
      // redirect from its own body and Integrations was not guarded at all.
      {
        path: "settings",
        Component: SettingsLayout,
        children: [
          { index: true, element: <Navigate to="/settings/account" replace /> },
          { path: "account",  Component: AccountSettings  },
          { path: "security", Component: SecuritySettings },
          { path: "company",      element: <RequireRole roles={WORKER_ADMIN_ROLES}><CompanySettings /></RequireRole> },
          { path: "billing",      element: <RequireRole roles={WORKER_ADMIN_ROLES}><BillingSettings /></RequireRole> },
          { path: "integrations", element: <RequireRole roles={OWNER_ONLY}>        <Integrations />   </RequireRole> },
        ],
      },

      { path: "workers", element: <RequireRole roles={WORKER_ADMIN_ROLES}><Workers /></RequireRole> },

      // The pre-hub URLs. Kept so bookmarks and the invitation email survive.
      { path: "account",      element: <Navigate to="/settings/account" replace />      },
      { path: "company",      element: <Navigate to="/settings/company" replace />      },
      { path: "integrations", element: <Navigate to="/settings/integrations" replace /> },
      // Workers lived in the hub only briefly; catch anything that points there.
      { path: "settings/workers", element: <Navigate to="/workers" replace /> },

      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
