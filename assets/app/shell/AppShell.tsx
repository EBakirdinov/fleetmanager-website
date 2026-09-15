import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import ZoomControls from "./ZoomControls";

export default function AppShell() {
  return (
    <div
      className="flex h-full w-full overflow-hidden bg-background text-foreground"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-5">
            <Outlet />
          </main>
        </div>
      </div>
      <ZoomControls />
    </div>
  );
}
