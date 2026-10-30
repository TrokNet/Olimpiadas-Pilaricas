import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ChartNoAxesColumnIncreasing, Pause, Play, Trophy } from 'lucide-react';
import { Modal } from './ui';
import { audienceVisitorId } from './useAudience';
import type { Tournament } from './types';
import './voting.css';

type Summary = { ranking: { team_id: string; votes: number }[]; my_votes: string[]; voters: number };
async function responseData(response: Response): Promise<Summary> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || 'No se pudieron guardar tus votos.');
  if (!Array.isArray(body.ranking) || !Array.isArray(body.my_votes)) throw new Error('Las votaciones no están disponibles.');
  return body;
}
export default function Voting({ data }: { data: Tournament }) {
  const [id] = useState(audienceVisitorId);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const revision = useRef(0);
  const initialized = useRef(false);
  const reduced = useReducedMotion();
  const endpoint = `${import.meta.env.BASE_URL}api/voting`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (busy.current) return;
    const version = revision.current;
    const body = await responseData(await fetch(`${endpoint}?visitor_id=${id}`, { cache: 'no-store', signal }));
    if (version !== revision.current || signal?.aborted) return;
    setSummary(body); setError('');
    if (!initialized.current) { initialized.current = true; setDraft(body.my_votes); }
  }, [endpoint, id]);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => {
      if (document.visibilityState !== 'hidden') void refresh(controller.signal).catch(() => {
        if (!controller.signal.aborted) setError('No se pudo actualizar el ranking. Inténtalo de nuevo.');
      });
    };
    update(); const timer = window.setInterval(update, 20000);
    document.addEventListener('visibilitychange', update);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [refresh]);
  const show = () => { setDraft(summary?.my_votes || []); setNotice(''); setOpen(true); void refresh().catch(() => setError('No se pudieron cargar las votaciones.')); };
  const toggle = (team: string) => {
    setNotice('');
    if (draft.includes(team)) { setDraft(draft.filter((value) => value !== team)); return; }
    if (draft.length === 3) { setNotice('Puedes elegir hasta 3 equipos. Desmarca uno para cambiarlo.'); return; }
    setDraft([...draft, team]);
  };
  const save = async () => {
    if (!draft.length || busy.current) return;
    busy.current = true; revision.current++; setSaving(true); setError(''); setNotice('');
    try {
      const body = await responseData(await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor_id: id, team_ids: draft }) }));
      setSummary(body); setDraft(body.my_votes); setNotice('¡Tus votos están guardados! Puedes cambiar tu selección cuando quieras.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron guardar tus votos.'); }
    finally { revision.current++; busy.current = false; setSaving(false); }
  };
  const ranking = summary?.ranking || [];
  const maximum = Math.max(1, ...ranking.map((row) => row.votes));
  const badge = (team: string) => data.art?.[team]?.image
    ? <img src={`${import.meta.env.BASE_URL}${data.art[team].image}`} alt="" loading="lazy" />
    : <Trophy size={16} />;
  return <>
    <section className={`voting-ribbon ${paused ? 'voting-paused' : ''}`} aria-label="Votaciones de la hinchada">
      <button className="voting-title" onClick={show}><Trophy size={19} /><span className="voting-pulse" /><strong>Votaciones</strong></button>
      <div className="voting-ticker" aria-live="off">
        {summary ? <div className="voting-ticker-track">{[0, 1].map((copy) => <div className="voting-ticker-set" key={copy} aria-hidden={copy === 1}>{ranking.map((row, index) => <span className={`voting-leader place-${index + 1}`} key={row.team_id}><b>{row.votes ? index + 1 : '—'}</b>{badge(row.team_id)}<span>{data.grades.find((g) => g.id === row.team_id)?.name}</span><strong>{row.votes.toLocaleString('es-PE')} <small>votos</small></strong></span>)}</div>)}</div> : <span className="voting-placeholder">{error ? 'Abre el panel para reintentar' : 'La hinchada elige. Apoya hasta 3 equipos.'}</span>}
      </div>
      <button className="voting-action" onClick={show}>Votar y ver ranking <ArrowRight size={16} /></button>
      <button className="voting-pause" onClick={() => setPaused(!paused)} aria-label={paused ? 'Reanudar movimiento de votaciones' : 'Pausar movimiento de votaciones'} aria-pressed={paused}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
    </section>
    <Modal open={open} onClose={() => setOpen(false)} title="La hinchada elige" description="Vota por 1, 2 o hasta 3 equipos" className="voting-modal">
      <div className="voting-panel-heading"><span><ChartNoAxesColumnIncreasing size={16} />{summary?.voters.toLocaleString('es-PE') || 0} navegadores votaron</span><strong>{draft.length} de 3 seleccionados</strong></div>
      {!summary && !error && <p className="voting-message">Cargando votaciones…</p>}
      {summary && summary.voters === 0 && <p className="voting-message">¡Inaugura la votación! Todavía no hay votos registrados.</p>}
      <ol className="voting-ranking">{ranking.map((row, index) => {
        const grade = data.grades.find((g) => g.id === row.team_id);
        const checked = draft.includes(row.team_id);
        return <motion.li key={row.team_id} layout={reduced ? false : 'position'} transition={{ type: 'spring', stiffness: 250, damping: 30 }} className={`place-${index + 1} ${checked ? 'is-selected' : ''}`}>
          <label><span className="voting-position">{row.votes ? index + 1 : '—'}</span><span className="voting-badge">{badge(row.team_id)}</span>
            <span className="voting-team"><strong>{grade?.name}</strong><small>{grade?.label}</small><span className="voting-meter"><motion.i initial={false} animate={{ width: `${row.votes / maximum * 100}%` }} transition={{ duration: reduced ? 0 : .65 }} /></span></span>
            <span className="voting-count"><strong>{row.votes.toLocaleString('es-PE')}</strong><small>{row.votes === 1 ? 'voto' : 'votos'}</small></span>
            <span className="voting-check"><input type="checkbox" checked={checked} disabled={saving} onChange={() => toggle(row.team_id)} aria-label={`Votar por ${grade?.name}`} /><span aria-hidden="true">{checked && <Check size={15} />}</span></span>
          </label>
        </motion.li>;
      })}</ol>
      <div className="voting-panel-footer">
        {error && <p role="alert" className="voting-error">{error} <button onClick={() => void refresh().catch(() => setError('No se pudo conectar. Vuelve a intentarlo.'))}>Reintentar</button></p>}
        {notice && <p role="status" className="voting-message">{notice}</p>}
        <button className="button coral" disabled={!summary || !draft.length || saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar mis votos'}<Check size={17} /></button>
        <small>Una selección por navegador, hasta 3 equipos. Cambiarla reemplaza tus votos anteriores. Esta votación no afecta los resultados deportivos.</small>
      </div>
    </Modal>
  </>;
}
