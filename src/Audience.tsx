import { useEffect, useState } from "react";
import {
  Activity,
  Users,
  Footprints,
  Archive,
  ShieldCheck,
  LogOut,
  RefreshCw,
} from "lucide-react";
import type { Tournament } from "./types";
import ResultLogin from "./ResultLogin";
import "./audience.css";

interface AudienceStats {
  online: number;
  total_visitors: number;
  total_visits: number;
  today_visitors: number;
  today_visits: number;
  period_visitors: number;
  updated_at: number;
  tracking_started_at: number | null;
  historical_coverage_from: string | null;
  recovered_accesses: number;
  history: {
    date: string;
    visitors: number;
    visits: number;
    recovered_accesses: number;
  }[];
}
const number = (value: number) => value.toLocaleString("es-PE");
const dayLabel = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(new Date(`${value}T12:00:00-05:00`));
const localDate = (stamp: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(stamp));

export default function Audience({
  data,
  onUpdate,
}: {
  data: Tournament;
  onUpdate: (data: Tournament) => void;
}) {
  const [stats, setStats] = useState<AudienceStats | null>(null);
  const [period, setPeriod] = useState("all");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [expired, setExpired] = useState(false);
  const admin = data.auth_user?.role === "admin";
  useEffect(() => {
    if (!admin || expired) return;
    const controller = new AbortController();
    const update = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const query =
          period === "all"
            ? "all_history=true"
            : `start=${localDate(Date.now() - (Number(period) - 1) * 86400000)}`;
        const response = await fetch(`/api/admin/analytics?${query}`, {
          credentials: "same-origin",
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 401) {
          setExpired(true);
          setStats(null);
          return;
        }
        if (!response.ok)
          throw new Error(
            "No se pudieron consultar las estadísticas. Intenta actualizar.",
          );
        setStats(await response.json());
        setError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Revisa tu conexión.");
      }
    };
    void update();
    const timer = window.setInterval(() => void update(), 30000);
    const visible = () => void update();
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [admin, expired, period, refresh]);
  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("No se pudo cerrar sesión.");
      setStats(null);
      onUpdate(await response.json());
    } catch {
      setError("No se pudo cerrar sesión. Intenta otra vez.");
    }
  };
  if (!data.auth_user || expired)
    return (
      <div className="page-content">
        <ResultLogin
          purpose="analytics"
          onUpdate={(updated) => {
            setExpired(false);
            onUpdate(updated);
          }}
        />
      </div>
    );
  if (!admin)
    return (
      <section className="page-content audience-denied">
        <ShieldCheck size={34} />
        <h1>Solo para el administrador</h1>
        <p>La cuenta de tu equipo no tiene acceso al historial de visitas.</p>
        <button className="button" onClick={() => void logout()}>
          Cambiar de cuenta
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  const max = Math.max(
    1,
    ...(stats?.history.flatMap((row) => [row.visits, row.recovered_accesses]) ||
      []),
  );
  return (
    <section className="page-content audience-page">
      <header className="audience-header">
        <div>
          <span className="audience-private">
            <ShieldCheck size={15} /> Panel privado
          </span>
          <h1>Así se vive la tribuna.</h1>
          <p>Tu audiencia, desde los primeros registros hasta ahora.</p>
        </div>
        <button className="button ghost" onClick={() => void logout()}>
          <LogOut size={16} /> Salir
        </button>
      </header>
      {error && (
        <p className="audience-error" role="alert">
          {error} Los datos anteriores pueden estar desactualizados.
        </p>
      )}
      {!stats ? (
        <p role="status">Consultando visitas…</p>
      ) : (
        <>
          <div className="audience-metrics">
            {[
              {
                label: "Conectados ahora",
                value: stats.online,
                detail: "Actividad en los últimos 2 minutos",
                Icon: Activity,
                live: true,
              },
              {
                label: "Visitantes hoy",
                value: stats.today_visitors,
                detail: `${number(stats.today_visits)} visitas hoy`,
                Icon: Users,
              },
              {
                label: "Visitantes acumulados",
                value: stats.total_visitors,
                detail: "Navegadores distintos desde la activación",
                Icon: Users,
              },
              {
                label: "Visitas acumuladas",
                value: stats.total_visits,
                detail: "Una nueva visita tras 30 min sin actividad",
                Icon: Footprints,
              },
            ].map(({ label, value, detail, Icon, live }) => (
              <article
                className={`audience-metric${live ? " is-live" : ""}`}
                key={label}
              >
                <div>
                  <Icon size={20} />
                  <span>{label}</span>
                </div>
                <strong>{number(value)}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>
          <aside className="audience-recovered">
            <Archive size={24} />
            <div>
              <strong>
                {number(stats.recovered_accesses)} accesos históricos
                recuperados
              </strong>
              <p>
                {stats.historical_coverage_from
                  ? `Registros disponibles desde el ${dayLabel(stats.historical_coverage_from)} de ${stats.historical_coverage_from.slice(0, 4)}.`
                  : "No hay registros anteriores disponibles en este servidor."}{" "}
                Son aperturas de la página; pueden incluir recargas y accesos
                técnicos. No permiten contar personas únicas.
              </p>
            </div>
          </aside>
          <section
            className="audience-history"
            aria-label="Historial diario de visitas"
          >
            <div className="audience-history-heading">
              <div>
                <h2>La tribuna, día a día</h2>
                <p>
                  {number(stats.period_visitors)} visitantes distintos en el
                  período medido
                </p>
              </div>
              <label>
                Período
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="all">Todo el historial disponible</option>
                  <option value="7">Últimos 7 días</option>
                  <option value="30">Últimos 30 días</option>
                </select>
              </label>
            </div>
            <div className="audience-legend">
              <span>
                <i /> Visitas medidas
              </span>
              <span>
                <i className="historical" /> Accesos recuperados
              </span>
            </div>
            <div
              className="audience-chart"
              role="img"
              aria-label="Barras diarias de visitas medidas y accesos históricos. Cifras exactas en la tabla inferior."
            >
              {stats.history.map((row) => (
                <div
                  className="audience-chart-day"
                  key={row.date}
                  title={
                    stats.tracking_started_at !== null &&
                    row.date >= localDate(stats.tracking_started_at * 1000)
                      ? `${dayLabel(row.date)}: ${number(row.visitors)} visitantes únicos conectados`
                      : `${dayLabel(row.date)}: no se midieron visitantes únicos; ${number(row.recovered_accesses)} accesos históricos`
                  }
                  aria-label={
                    stats.tracking_started_at !== null &&
                    row.date >= localDate(stats.tracking_started_at * 1000)
                      ? `${dayLabel(row.date)}: ${number(row.visitors)} visitantes únicos conectados`
                      : `${dayLabel(row.date)}: visitantes únicos sin medición; ${number(row.recovered_accesses)} accesos históricos`
                  }
                >
                  <div className="audience-chart-bars">
                    <span
                      style={{ height: `${(row.visits / max) * 100}%` }}
                    />
                    <span
                      className="historical"
                      style={{
                        height: `${(row.recovered_accesses / max) * 100}%`,
                      }}
                    />
                  </div>
                  <small>{dayLabel(row.date)}</small>
                </div>
              ))}
            </div>
            <details className="audience-table">
              <summary>Ver cifras por día</summary>
              <div>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Visitantes</th>
                      <th>Visitas</th>
                      <th>Accesos recuperados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.history
                      .slice()
                      .reverse()
                      .map((row) => {
                        const measured =
                          stats.tracking_started_at !== null &&
                          row.date >=
                            localDate(stats.tracking_started_at * 1000);
                        return (
                          <tr key={row.date}>
                            <th>{dayLabel(row.date)}</th>
                            <td>{measured ? number(row.visitors) : "—"}</td>
                            <td>{measured ? number(row.visits) : "—"}</td>
                            <td>{number(row.recovered_accesses)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          <div className="audience-status">
            <span>
              Actualizado a las{" "}
              {new Intl.DateTimeFormat("es-PE", {
                timeZone: "America/Lima",
                timeStyle: "short",
              }).format(new Date(stats.updated_at * 1000))}{" "}
              · Lima
            </span>
            <button
              className="text-button"
              onClick={() => setRefresh((n) => n + 1)}
            >
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>
          <details className="audience-method">
            <summary>Cómo se cuentan las visitas</summary>
            <p>
              El conteo de navegadores comenzó{" "}
              {stats.tracking_started_at
                ? `el ${dayLabel(localDate(stats.tracking_started_at * 1000))}`
                : "cuando se active el primer visitante"}
              . Varias pestañas del mismo navegador cuentan como un visitante.
              Otro dispositivo o borrar el almacenamiento puede contar
              nuevamente. Solo las pestañas visibles envían actividad; al
              cerrar, el contador se ajusta en hasta 2 minutos. No se guardan
              nombres, direcciones IP ni mensajes. Los visitantes únicos
              anteriores a la activación no se pueden reconstruir; los registros
              históricos no garantizan cobertura completa desde la creación del
              sistema.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
