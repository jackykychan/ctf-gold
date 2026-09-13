import { createRoot } from "react-dom/client";
import { App } from "@/App";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root");
createRoot(container).render(<App />);

// Register the service worker that receives Web Push notifications.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed", err);
    });
  });
}
