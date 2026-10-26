import { useEffect, useState } from "react";
import { Flag } from "lucide-react";

// Explicit Lima offset: visitors in other time zones count down to the same instant.
export const OPENING_AT = Date.parse("2026-10-31T07:00:00-05:00");

export function openingRemaining(now: number) {
  const total = Math.max(0, Math.ceil((OPENING_AT - now) / 1000));
  return {
    started: now >= OPENING_AT,
    values: [Math.floor(total / 86400), Math.floor(total / 3600) % 24,
      Math.floor(total / 60) % 60, total % 60],
  };
}

export default function OpeningCountdown() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    // Recalculate from the clock after a phone wakes up, without accumulated drift.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const { started, values } = openingRemaining(now);
  const labels = ["Días", "Horas", "Minutos", "Segundos"];
  return (
    <section className="opening-countdown" aria-label="Inicio de las Olimpiadas Pilaricas">
      <div className="opening-countdown-heading">
        <span><Flag size={16} aria-hidden="true" /> {started ? "¡Las Olimpiadas ya comenzaron!" : "La emoción comienza en"}</span>
        <time dateTime="2026-10-31T07:00:00-05:00">31 oct · 7:00 a. m. <small>Lima</small></time>
      </div>
      {!started && <div className="opening-countdown-clock" role="timer" aria-live="off"
        aria-label={values.map((value, i) => `${value} ${labels[i].toLowerCase()}`).join(", ")}>
        {values.map((value, i) => <div className="opening-countdown-unit" key={labels[i]}>
          <strong>{String(value).padStart(2, "0")}</strong><span>{labels[i]}</span>
        </div>)}
      </div>}
    </section>
  );
}
