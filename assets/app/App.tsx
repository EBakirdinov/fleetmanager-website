import { createBrowserRouter, RouterProvider, Navigate } from "react-router";
import AppShell from "./shell/AppShell";
import { RequireAuth, RequirePermission } from "./lib/auth";
import { MODULES } from "./lib/permissions";
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
import Brokers from "./pages/Brokers";
import Expenses from "./pages/Expenses";
import Maintenance from "./pages/Maintenance";
import EmployeeRetention from "./pages/EmployeeRetention";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Integrations from "./pages/Integrations";
import Workers from "./pages/Workers";
import SettingsLayout from "./pages/settings/SettingsLayout";
import AccountSettings from "./pages/settings/AccountSettings";
import SecuritySettings from "./pages/settings/SecuritySettings";
import CompanySettings from "./pages/settings/CompanySettings";
import BillingSettings from "./pages/settings/BillingSettings";

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
      // Gated on their permission module. These were open to anyone signed
      // in, which is what let a Dispatcher reach every page in the app. The
      // editor routes ask for "manage" rather than mere visibility, so a
      // view-only user cannot open a form they are unable to submit.
      { path: "dashboard", element: <RequirePermission module={MODULES.dashboard}><Dashboard /></RequirePermission> },
      { path: "trucks",    element: <RequirePermission module={MODULES.trucks}><Trucks /></RequirePermission>       },
      { path: "trailers",  element: <RequirePermission module={MODULES.trailers}><Trailers /></RequirePermission>   },
      { path: "drivers",   element: <RequirePermission module={MODULES.drivers}><Drivers /></RequirePermission>     },
      { path: "loads",     element: <RequirePermission module={MODULES.loads}><Loads /></RequirePermission>         },
      { path: "loads/new", element: <RequirePermission module={MODULES.loads} level="manage"><LoadAdd /></RequirePermission>  },
      { path: "loads/:id", element: <RequirePermission module={MODULES.loads}><LoadEdit /></RequirePermission>      },
      { path: "brokers",     element: <RequirePermission module={MODULES.brokers}><Brokers /></RequirePermission>         },
      { path: "expenses",    element: <RequirePermission module={MODULES.expenses}><Expenses /></RequirePermission>       },
      { path: "maintenance", element: <RequirePermission module={MODULES.maintenance}><Maintenance /></RequirePermission> },
      { path: "retention",   element: <RequirePermission module={MODULES.employeeRetention}><EmployeeRetention /></RequirePermission> },
      { path: "fuel",      element: <RequirePermission module={MODULES.reports}><Fuel /></RequirePermission>        },
      { path: "reports",   element: <RequirePermission module={MODULES.reports}><Reports /></RequirePermission>     },
      { path: "documents", element: <RequirePermission module={MODULES.documents}><Documents /></RequirePermission> },

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
          { path: "company",      element: <RequirePermission module={MODULES.settings}><CompanySettings /></RequirePermission>         },
          { path: "billing",      element: <RequirePermission module={MODULES.billing}><BillingSettings /></RequirePermission>          },
          { path: "integrations", element: <RequirePermission module={MODULES.integrations}><Integrations /></RequirePermission>         },
        ],
      },

      { path: "workers", element: <RequirePermission module={MODULES.users}><Workers /></RequirePermission> },

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
