import { useEffect } from "react";

let temporaryId: string | undefined;
function visitorId() {
  try {
    let id = localStorage.getItem("pilaricas-audience-id");
    if (!id || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem("pilaricas-audience-id", id);
    }
    return id;
  } catch {
    temporaryId ??= crypto.randomUUID();
    return temporaryId;
  }
}

export default function useAudience() {
  useEffect(() => {
    const id = visitorId();
    const controller = new AbortController();
    const ping = () => {
      if (document.visibilityState === "hidden") return;
      void fetch("/api/analytics/heartbeat", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_id: id }),
      }).catch(() => {
        /* Audience tracking never interrupts the sports experience. */
      });
    };
    ping();
    const timer = window.setInterval(ping, 30000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
}
