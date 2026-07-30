import { createBrowserRouter, RouterProvider, Navigate } from "react-router";
import AppShell from "./shell/AppShell";
import { RequireAuth } from "./lib/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Trucks from "./pages/Trucks";
import Trailers from "./pages/Trailers";
import Drivers from "./pages/Drivers";
import Fuel from "./pages/Fuel";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Company from "./pages/Company";
import Integrations from "./pages/Integrations";
import Account from "./pages/Account";

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
      { path: "fuel",      Component: Fuel      },
      { path: "reports",   Component: Reports   },
      { path: "documents", Component: Documents },
      { path: "company",      Component: Company      },
      { path: "integrations", Component: Integrations },
      { path: "account",      Component: Account      },
      { path: "settings",  element: <Navigate to="/account" replace /> },
      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
