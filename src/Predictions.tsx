import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CircleDot, LockKeyhole, Sparkles } from 'lucide-react';
import type { Match, Tournament } from './types';
import { SPORTS } from './types';
import { dayLabel, gradeFor, matchName, timestamp } from './lib';
import { visitorId } from './visitorIdentity';
import './engagement.css';

type Vote = { home: number; away: number; my_vote: 'home' | 'away' | null; open: boolean };
function rival(data: Tournament, id: string | null, label: string) {
  return id ? gradeFor(data, id)?.name ?? matchName(data, id, label) : matchName(data, id, label);
}

export default function Predictions({ data, teamId }: { data: Tournament; teamId?: string }) {
  const [sport, setSport] = useState('');
  const matches = useMemo(() => data.matches
    .filter((match) => match.kind === 'OFICIAL' && match.home_id && match.away_id && timestamp(match, true) > Date.now())
    .filter((match) => !sport || match.sport === sport)
    .filter((match) => !teamId || [match.home_id, match.away_id].some((id) => id && data.entries.find((entry) => entry.id === id)?.grade_id === teamId))
    .sort((a, b) => timestamp(a, true) - timestamp(b, true)).slice(0, 3), [data, sport, teamId]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const id = visitorId();
    matches.forEach((match) => {
      const query = new URLSearchParams({ visitor_id: id });
      fetch(`${import.meta.env.BASE_URL}api/predictions/${encodeURIComponent(match.id)}?${query}`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() as Promise<Vote> : Promise.reject())
        .then((vote) => { if (active) setVotes((current) => ({ ...current, [match.id]: vote })); })
        .catch(() => undefined);
    });
    return () => { active = false; };
  }, [matches]);

  const castVote = async (match: Match, choice: 'home' | 'away') => {
    setSaving(match.id); setNotice('');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/predictions/${encodeURIComponent(match.id)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: visitorId(), choice }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || 'No se pudo guardar el pronóstico.');
      setVotes((current) => ({ ...current, [match.id]: body as Vote }));
      setNotice('Pronóstico guardado.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el pronóstico.');
    } finally { setSaving(''); }
  };

  return <section className="predictions-section">
    <header className="community-section-heading">
      <div><span className="eyebrow coral-text"><Sparkles size={14} /> LA VOZ DE LA HINCHADA</span><h2>¿Quién gana?</h2><p>Pronostica antes del inicio y mira cómo late la tribuna.</p></div>
      <label className="prediction-filter"><span className="sr-only">Filtrar pronósticos por disciplina</span><select value={sport} onChange={(event) => setSport(event.target.value)}><option value="">Todos los deportes</option>{SPORTS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
    </header>
    {matches.length ? <div className="prediction-grid">{matches.map((match) => {
      const vote = votes[match.id]; const home = rival(data, match.home_id, match.home_label); const away = rival(data, match.away_id, match.away_label);
      const total = (vote?.home || 0) + (vote?.away || 0); const homePercent = total ? Math.round((vote!.home / total) * 100) : 50;
      return <article className="prediction-card" key={match.id}>
        <div className="prediction-meta"><span><CircleDot size={14} /> {SPORTS.find((item) => item.id === match.sport)?.label ?? 'Básquet'}</span><b>{dayLabel(match.date)} · {match.start}</b></div>
        <div className="prediction-teams"><span>{home}</span><em>VS</em><span>{away}</span></div>
        {vote && <div className="prediction-poll" aria-label={`${home}: ${homePercent}%, ${away}: ${100-homePercent}%`}><span style={{ width: `${homePercent}%` }} /><span style={{ width: `${100-homePercent}%` }} /></div>}
        <div className="prediction-counts"><span>{home} <b>{vote?.home ?? 0}</b></span><span>{vote?.away ?? 0} <b>{away}</b></span></div>
        {vote?.open === false ? <div className="prediction-closed"><LockKeyhole size={14} /> Pronóstico cerrado</div> : <div className="prediction-actions"><button className={vote?.my_vote === 'home' ? 'selected' : ''} disabled={saving === match.id} onClick={() => void castVote(match, 'home')}>{vote?.my_vote === 'home' ? 'Tu elección' : `Gana ${home}`}</button><button className={vote?.my_vote === 'away' ? 'selected' : ''} disabled={saving === match.id} onClick={() => void castVote(match, 'away')}>{vote?.my_vote === 'away' ? 'Tu elección' : `Gana ${away}`}</button></div>}
      </article>;
    })}</div> : <div className="prediction-empty">Todavía no hay partidos próximos para pronosticar. Vuelve a revisar el calendario.</div>}
    <div className="prediction-foot"><span>{notice}</span><small>Se puede cambiar el voto hasta la hora programada.</small><a href="#fixture" aria-label="Ver calendario"><ArrowRight size={16} /></a></div>
  </section>;
}
