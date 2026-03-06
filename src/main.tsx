import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ThemeProvider } from "./context/ThemeContext";
import { FontProvider } from "./context/FontContext";
import { isWorkOSConfigured } from "./utils/workos";

// Typography
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/500.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";

import "./styles/global.css";

// Disable browser scroll restoration to prevent scroll position being restored on navigation
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

// Lazy load the appropriate App wrapper based on WorkOS configuration
const AppWithWorkOS = lazy(() => import("./AppWithWorkOS"));
const App = lazy(() => import("./App"));

// Minimal loading fallback - no visible text to prevent flash
function LoadingFallback() {
  return <div style={{ minHeight: "100vh" }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <FontProvider>
          <Suspense fallback={<LoadingFallback />}>
            {isWorkOSConfigured ? (
              <AppWithWorkOS convex={convex} />
            ) : (
              <ConvexProvider client={convex}>
                <App />
              </ConvexProvider>
            )}
          </Suspense>
        </FontProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
