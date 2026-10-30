import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Pause, Play, Trophy, Search, X } from 'lucide-react';
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
  const [search, setSearch] = useState('');
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
  const show = () => { setDraft(summary?.my_votes || []); setNotice(''); setSearch(''); setOpen(true); void refresh().catch(() => setError('No se pudieron cargar las votaciones.')); };
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
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visibleRanking = ranking.map((row, index) => ({ ...row, position: index + 1 })).filter((row) => {
    const grade = data.grades.find((g) => g.id === row.team_id);
    return normalize(`${grade?.name} ${grade?.label}`).includes(normalize(search.trim()));
  });
  const badge = (team: string) => data.art?.[team]?.image
    ? <img src={`${import.meta.env.BASE_URL}${data.art[team].image}`} alt="" loading="lazy" />
    : <Trophy size={16} />;
  return <>
    <section className={`voting-ribbon ${paused ? 'voting-paused' : ''}`} aria-label="Votaciones de la hinchada">
      <button className="voting-title" onClick={show}><Trophy size={19} /><span className="voting-pulse" /><strong>Votaciones</strong></button>
      <div className="voting-ticker" aria-live="off">
        {summary ? <div className="voting-ticker-track">{[0, 1].map((copy) => <div className="voting-ticker-set" key={copy} aria-hidden={copy === 1}>{ranking.map((row, index) => <button type="button" className={`voting-leader ${row.votes > 0 ? `place-${index + 1}` : ''}`} key={row.team_id} tabIndex={copy ? -1 : 0} aria-label={`Ver votos de ${data.grades.find((g) => g.id === row.team_id)?.name}`} onClick={() => { show(); setSearch(data.grades.find((g) => g.id === row.team_id)?.name || ''); }}><b>{row.votes ? index + 1 : '—'}</b>{badge(row.team_id)}<span>{data.grades.find((g) => g.id === row.team_id)?.name}</span><strong key={row.votes} className="voting-live-count">{row.votes.toLocaleString('es-PE')} <small>{row.votes === 1 ? 'voto' : 'votos'}</small></strong></button>)}</div>)}</div> : <span className="voting-placeholder">{error ? 'Abre el panel para reintentar' : 'La hinchada elige. Apoya hasta 3 equipos.'}</span>}
      </div>
      <button className="voting-action" onClick={show}>Votar y ver ranking <ArrowRight size={16} /></button>
      <button className="voting-pause" onClick={() => setPaused(!paused)} aria-label={paused ? 'Reanudar movimiento de votaciones' : 'Pausar movimiento de votaciones'} aria-pressed={paused}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
    </section>
    <Modal open={open} onClose={() => setOpen(false)} title="La hinchada elige" description="Elige hasta 3 equipos y haz sentir tu apoyo" className="voting-modal">
      <span className="voting-crest" aria-hidden="true"><Trophy size={27} /></span>
      <div className="voting-panel-heading"><span className="voting-slots" aria-hidden="true">{[0, 1, 2].map((slot) => <i key={slot} className={slot < draft.length ? 'filled' : ''} />)}</span><strong>{draft.length} de 3 equipos</strong><span className="voting-open"><i />Votación abierta</span></div>
      <label className="voting-search"><Search size={17} /><input type="search" placeholder="Buscar equipo o grado" aria-label="Buscar equipo o grado para votar" value={search} onChange={(e) => setSearch(e.target.value)} />{search && <button aria-label="Limpiar búsqueda de equipos" onClick={() => setSearch('')}><X size={15} /></button>}</label>
      {!summary && !error && <p className="voting-message">Cargando votaciones…</p>}
      {summary && summary.voters === 0 && <p className="voting-empty-intro"><strong>Sin votos todavía</strong><span>Sé el primero en apoyar a tu equipo.</span></p>}
      <ol className="voting-ranking">{visibleRanking.map((row) => {
        const grade = data.grades.find((g) => g.id === row.team_id);
        const checked = draft.includes(row.team_id);
        return <motion.li key={row.team_id} layout={reduced ? false : 'position'} transition={{ type: 'spring', stiffness: 250, damping: 30 }} className={`${row.votes > 0 ? `place-${row.position}` : ''} ${checked ? 'is-selected' : ''}`}>
          <label><span className="voting-position">{row.votes ? row.position : '—'}</span><span className="voting-badge">{badge(row.team_id)}</span>
            <span className="voting-team"><strong>{grade?.name}</strong><small>{grade?.label}</small><span className="voting-meter"><motion.i initial={false} animate={{ width: `${row.votes / maximum * 100}%` }} transition={{ duration: reduced ? 0 : .65 }} /></span></span>
            <span className="voting-count"><strong>{row.votes.toLocaleString('es-PE')}</strong><small>{row.votes === 1 ? 'voto' : 'votos'}</small></span>
            <span className="voting-check"><input type="checkbox" checked={checked} disabled={saving} onChange={() => toggle(row.team_id)} aria-label={`Votar por ${grade?.name}`} /><span aria-hidden="true">{checked && <Check size={15} />}</span></span>
          </label>
        </motion.li>;
      })}</ol>
      {summary && !visibleRanking.length && <p className="voting-message">No encontramos ese equipo. Prueba con su grado.</p>}
      <div className="voting-panel-footer">
        <div className="voting-selected"><small>Tus selecciones ({draft.length}/3)</small><div>{draft.length ? draft.map((team) => <button key={team} disabled={saving} onClick={() => toggle(team)} aria-label={`Quitar voto a ${data.grades.find((g) => g.id === team)?.name}`}>{badge(team)}<span>{data.grades.find((g) => g.id === team)?.name}</span><X size={12} /></button>) : <span>Elige de 1 a 3 equipos de la lista.</span>}</div></div>
        {error && <p role="alert" className="voting-error">{error} <button onClick={() => void refresh().catch(() => setError('No se pudo conectar. Vuelve a intentarlo.'))}>Reintentar</button></p>}
        {notice && <p role="status" className="voting-message">{notice}</p>}
        <button className="button coral" disabled={!summary || !draft.length || saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Confirmar mis votos'}<Check size={17} /></button>
        <small>Puedes cambiar tu selección. Un voto por equipo y navegador. No afecta los resultados deportivos.{summary && summary.voters > 0 ? ` ${summary.voters.toLocaleString('es-PE')} navegadores votaron.` : ''}</small>
      </div>
    </Modal>
  </>;
}
