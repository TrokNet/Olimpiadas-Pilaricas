import { useCallback, useEffect, useRef, useState } from "react";
import {
  Heart,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";
import type { CSSProperties, FormEvent } from "react";
import type { Tournament } from "./types";
import { COLOR } from "./types";
import { Modal } from "./ui";
import "./fans.css";

type FanMessage = {
  id: string;
  team_id: string;
  author: string;
  message: string;
  created_at: string;
};
type Feed = {
  messages: FanMessage[];
  total: number;
  next_cursor: string | null;
};
async function readResponse(response: Response) {
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = (await response.json()).detail;
    } catch {
      /* Static-only hosting has no Fans API. */
    }
    throw new Error(
      typeof detail === "string"
        ? detail
        : "No se pudo conectar con el muro de Fans. Inténtalo de nuevo.",
    );
  }
  return response.json();
}
export default function Fans({
  data,
  initialTeamId = "",
}: {
  data: Tournament;
  initialTeamId?: string;
}) {
  const [team, setTeam] = useState(initialTeamId);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("");
  const [messages, setMessages] = useState<FanMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [target, setTarget] = useState<FanMessage | null>(null);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(
    async (cursor: string | null = null) => {
      controller.current?.abort();
      const pending = new AbortController();
      controller.current = pending;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (filter) params.set("team_id", filter);
        if (cursor) params.set("cursor", cursor);
        const feed: Feed = await readResponse(
          await fetch(`${import.meta.env.BASE_URL}api/fans?${params}`, {
            signal: pending.signal,
            cache: "no-store",
          }),
        );
        if (!pending.signal.aborted) {
          setMessages((previous) =>
            cursor ? [...previous, ...feed.messages] : feed.messages,
          );
          setTotal(feed.total);
          setNext(feed.next_cursor);
        }
      } catch (e) {
        if (!pending.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el historial.",
          );
      } finally {
        if (!pending.signal.aborted) setLoading(false);
      }
    },
    [filter],
  );
  useEffect(() => {
    setMessages([]);
    void load();
    return () => controller.current?.abort();
  }, [load, refresh]);
  const publish = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await readResponse(
        await fetch(`${import.meta.env.BASE_URL}api/fans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_id: team,
            author: author.trim(),
            message: text.trim(),
          }),
        }),
      );
      setText("");
      setFilter(team);
      setRefresh((n) => n + 1);
      setNotice("¡Tu mensaje ya está en la tribuna!");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "No se pudo publicar el mensaje.",
      );
    } finally {
      setSaving(false);
    }
  };
  const closeDelete = () => {
    if (!deleting) {
      setTarget(null);
      setPassword("");
      setDeleteError("");
    }
  };
  const remove = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await readResponse(
        await fetch(
          `${import.meta.env.BASE_URL}api/fans/${encodeURIComponent(target.id)}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          },
        ),
      );
      setTarget(null);
      setPassword("");
      setRefresh((n) => n + 1);
      setNotice("Mensaje eliminado.");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setDeleting(false);
    }
  };
  const dateFormat = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <section className="page-content fans-page">
      <header className="fans-heading">
        <div>
          <span className="fans-label">
            <Megaphone size={17} />
            La voz de nuestra hinchada
          </span>
          <h1>
            Fans<span className="coral-dot">.</span>
          </h1>
          <p>Un mensaje también juega. Deja tu aliento para tu equipo.</p>
        </div>
        <div className="fans-emblem" aria-hidden="true">
          <Heart size={50} />
          <span>
            Juntos en
            <br />
            la tribuna
          </span>
        </div>
      </header>
      <div className="fans-layout">
        <aside className="fans-composer">
          <span className="fans-composer-icon">
            <Send size={21} />
          </span>
          <h2>Hazte sentir.</h2>
          <p>
            Tu mensaje quedará en el historial para que todos puedan leerlo.
          </p>
          <form onSubmit={publish}>
            <label>
              ¿A qué equipo alientas?
              <select
                required
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              >
                <option value="">Elige tu equipo</option>
                {data.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tu nombre <small>(opcional)</small>
              <input
                maxLength={40}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Hincha pilarico"
                autoComplete="nickname"
              />
            </label>
            <label>
              Tu mensaje
              <textarea
                required
                maxLength={500}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="¡Vamos, equipo! Hoy alentamos juntos."
              />
            </label>
            <div className="fans-form-meta">
              <span>Con respeto y buena energía.</span>
              <span>{text.length}/500</span>
            </div>
            <button
              className="button coral"
              disabled={saving || !team || !text.trim()}
            >
              <Send size={16} />
              {saving ? "Publicando…" : "Publicar mensaje"}
            </button>
          </form>
          {notice && (
            <p role="status" className="fans-notice">
              {notice}
            </p>
          )}
        </aside>
        <section className="fans-history" aria-label="Historial de mensajes">
          <header>
            <div>
              <h2>La tribuna</h2>
              <span>
                {total} {total === 1 ? "mensaje" : "mensajes"}
              </span>
            </div>
            <label>
              <span className="sr-only">Filtrar mensajes por equipo</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Todos los equipos</option>
                {data.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.label}
                  </option>
                ))}
              </select>
            </label>
          </header>
          {error && (
            <div className="fans-feed-error" role="alert">
              <p>{error}</p>
              <button
                className="text-button"
                onClick={() => setRefresh((n) => n + 1)}
              >
                Volver a intentar
              </button>
            </div>
          )}
          {loading && !messages.length && (
            <p className="fans-loading" role="status">
              Cargando la tribuna…
            </p>
          )}
          {!loading && !error && !messages.length && (
            <div className="fans-empty">
              <MessageCircle size={38} />
              <h3>El primer aliento puede ser tuyo.</h3>
              <p>
                Todavía no hay mensajes{filter ? " para este equipo" : ""}.
                ¡Anímate a escribir!
              </p>
            </div>
          )}
          <div className="fans-message-grid">
            {messages.map((message) => {
              const grade = data.grades.find((g) => g.id === message.team_id);
              return (
                <article
                  className="fan-message"
                  key={message.id}
                  style={
                    {
                      "--fan-color": COLOR[grade?.color || "Coral"],
                    } as CSSProperties
                  }
                >
                  <header>
                    <span className="fan-team">
                      <i />
                      {grade?.name || "Equipo"}
                      <small>{grade?.label}</small>
                    </span>
                    <button
                      className="fan-delete"
                      type="button"
                      aria-label={`Eliminar mensaje de ${message.author}`}
                      onClick={() => {
                        setTarget(message);
                        setPassword("");
                        setDeleteError("");
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </header>
                  <p>{message.message}</p>
                  <footer>
                    <strong>{message.author}</strong>
                    <time dateTime={message.created_at}>
                      {dateFormat.format(new Date(message.created_at))}
                    </time>
                  </footer>
                </article>
              );
            })}
          </div>
          {next && (
            <button
              className="button outline fans-more"
              disabled={loading}
              onClick={() => void load(next)}
            >
              {loading ? "Cargando…" : "Ver mensajes anteriores"}
            </button>
          )}
        </section>
      </div>
      {target && (
        <Modal
          open
          onClose={closeDelete}
          title="Eliminar mensaje"
          description="Introduce la clave de administración para borrar este mensaje del historial."
          className="fans-delete-modal"
        >
          <div className="fans-delete-preview">{target.message}</div>
          <form onSubmit={remove}>
            <label>
              <LockKeyhole size={16} />
              Clave de administración
              <input
                type="password"
                required
                maxLength={128}
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {deleteError && (
              <p role="alert" className="form-error">
                {deleteError}
              </p>
            )}
            <div>
              <button
                type="button"
                className="button outline"
                onClick={closeDelete}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button className="button coral" disabled={deleting || !password}>
                {deleting ? "Eliminando…" : "Eliminar mensaje"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
