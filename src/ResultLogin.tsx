import { useState } from "react";
import type { Tournament } from "./types";
import { LockKeyhole, LogIn } from "lucide-react";
export default function ResultLogin({
  onUpdate,
  purpose = "results",
}: {
  onUpdate: (data: Tournament) => void;
  purpose?: "results" | "analytics";
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section
      className="result-login"
      aria-label={purpose === "analytics" ? "Acceso a estadísticas privadas" : "Acceso para registrar resultados"}
    >
      <div className="result-login-icon">
        <LockKeyhole size={26} />
      </div>
      <h2>{purpose === "analytics" ? "Tu tribuna, en números" : "El resultado de tu equipo"}</h2>
      <p>
        {purpose === "analytics" ? "Ingresa con tu cuenta de administrador para consultar las visitas y los conectados." : "Ingresa con la cuenta de tu salón para registrar ambos marcadores de sus partidos."}
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/auth/login", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, password }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(
                typeof result.detail === "string"
                  ? result.detail
                  : "No se pudo iniciar sesión.",
              );
            setPassword("");
            onUpdate(result);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Revisa tu conexión.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Usuario
          <input
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={80}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button coral" disabled={busy}>
          <LogIn size={17} />
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
      <small>
        {purpose === "analytics" ? "Estas estadísticas son privadas. Solo el administrador tiene acceso." : "El administrador puede registrar partidos de todos los equipos."}
      </small>
    </section>
  );
}
