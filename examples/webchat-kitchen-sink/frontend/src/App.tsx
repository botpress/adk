import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { FireAndForgetDemo } from "@/components/demos/FireAndForgetDemo";
import { RequestResponseDemo } from "@/components/demos/RequestResponseDemo";
import { CustomBlocksDemo } from "@/components/demos/CustomBlocksDemo";
import { BotRequestsDemo } from "@/components/demos/BotRequestsDemo";
import "./index.css";

export type DemoId =
  | "fire-and-forget"
  | "request-response"
  | "custom-blocks"
  | "bot-requests";

export function useActiveDemo(): DemoId {
  const location = useLocation();
  const path = location.pathname.replace(/^\//, "") || "fire-and-forget";
  return path as DemoId;
}

function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/fire-and-forget" replace />} />
          <Route path="/fire-and-forget" element={<FireAndForgetDemo />} />
          <Route path="/request-response" element={<RequestResponseDemo />} />
          <Route path="/custom-blocks" element={<CustomBlocksDemo />} />
          <Route path="/bot-requests" element={<BotRequestsDemo />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
