import { useEffect, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { visitorId } from './visitorIdentity';
import './engagement.css';

type AttendanceState = { count: number; attending: boolean };
export default function AttendanceButton({ matchId }: { matchId: string }) {
  const [state, setState] = useState<AttendanceState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = visitorId();
    const query = new URLSearchParams({ visitor_id: id });
    fetch(`${import.meta.env.BASE_URL}api/attendance/${encodeURIComponent(matchId)}?${query}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((value: AttendanceState) => setState(value))
      .catch(() => setState(null));
  }, [matchId]);

  const toggle = async () => {
    if (!state || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/attendance/${encodeURIComponent(matchId)}`, {
        method: state.attending ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: visitorId() }),
      });
      if (!response.ok) throw new Error();
      setState(await response.json() as AttendanceState);
    } catch {
      /* The calendar stays usable if the API is temporarily unavailable. */
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  return (
    <button className={`attendance-button ${state.attending ? 'is-attending' : ''}`} onClick={toggle} disabled={busy} aria-pressed={state.attending}>
      {state.attending ? <Check size={16} /> : <Users size={16} />}
      <span>{state.attending ? 'Vas a alentar' : 'Voy a alentar'}</span>
      <b>{state.count}</b>
    </button>
  );
}
