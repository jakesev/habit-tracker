import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline + installable. Skipped where service workers aren't allowed (e.g. sandboxed previews).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

if (import.meta.env.DEV) {
  import("./store/store").then((m) => ((window as unknown as { __stride: unknown }).__stride = m.useStore));
}
