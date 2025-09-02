import { Outlet } from "react-router-dom";
import RightNav from "./RightNav";

export default function Layout() {
  return (
    <div className="min-h-dvh bg-base-200">
      <RightNav />
      {/* add right padding so content doesn't sit under the navbar */}
      <main className="min-h-dvh p-6 pr-24">
        <Outlet />
      </main>
    </div>
  );
}
