import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PageErrorBoundary from "./PageErrorBoundary";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./styles.css";
import "./stadium.css";
window.addEventListener('vite:preloadError', (event) => {
  try {
    const key = 'pilaricas-chunk-recovery';
    const previous = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - previous < 60000) return;
    sessionStorage.setItem(key, String(Date.now()));
    event.preventDefault();
    window.location.reload();
  } catch { /* The boundary offers a manual reload if storage is unavailable. */ }
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PageErrorBoundary><App /></PageErrorBoundary>
  </React.StrictMode>,
);
