import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, PawPrint, Shield, Upload, X } from 'lucide-react';
import type { FormEvent } from 'react';
import type { Tournament } from './types';
import './teamIdentity.css';

type Item = { id: string; team_id: string; status: string; created_at: string; assets: Record<string, string> };
async function read(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || 'No se pudo completar la solicitud.');
  return body;
}
function fileData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
export default function TeamIdentity({ data, teamId, review = false }: { data: Tournament; teamId?: string; review?: boolean }) {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('pending');
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const grade = data.grades.find((g) => g.id === teamId);
  const endpoint = `${import.meta.env.BASE_URL}api/team-identity`;
  const load = async () => {
    const body = await read(await fetch(`${endpoint}/review`, { cache: 'no-store' }));
    setItems(Array.isArray(body.submissions) ? body.submissions : []);
  };
  useEffect(() => { if (review) void load().catch(() => setError('No se pudieron cargar los envíos.')); }, [review]);
  useEffect(() => { setFiles({}); setError(''); setNotice(''); formRef.current?.reset(); }, [teamId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    if (!teamId || !Object.keys(files).length) { setError('Elige al menos un logo o una mascota.'); return; }
    setBusy(true);
    try {
      const payload: Record<string, string> = { team_id: teamId };
      for (const [kind, file] of Object.entries(files)) {
        if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Elige archivos PNG o JPG.');
        if (file.size > 2 * 1024 * 1024) throw new Error('Cada archivo debe pesar hasta 2 MB.');
        payload[kind] = await fileData(file);
      }
      const body = await read(await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      setNotice(body.message); setFiles({}); formRef.current?.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };
  const decide = async (item: Item, status: string) => {
    setBusy(true); setError('');
    try {
      await read(await fetch(`${endpoint}/${item.id}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }));
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, status } : row));
      setNotice(status === 'approved' ? 'Envío aprobado y guardado. El diseño actual se conserva.' : 'Envío rechazado.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo revisar.'); }
    finally { setBusy(false); }
  };
  if (review) return <details className="identity-inbox">
    <summary><Shield size={18} /> Logos y mascotas <span>{items.filter((i) => i.status === 'pending').length} pendientes</span></summary>
    <div className="identity-inbox-body">
      <p>Revisa los archivos enviados por los equipos. Aprobarlos los conserva para su uso posterior; no cambia la web automáticamente.</p>
      <label>Mostrar <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="pending">Pendientes</option><option value="approved">Aprobados</option><option value="rejected">Rechazados</option><option value="all">Todos</option></select></label>
      <button type="button" onClick={() => void load().catch(() => setError('No se pudo actualizar.'))}>Actualizar envíos</button>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <div className="identity-submissions">{items.filter((i) => filter === 'all' || i.status === filter).map((item) => <article key={item.id}>
        <strong>{data.grades.find((g) => g.id === item.team_id)?.name || item.team_id}</strong>
        <small>{data.grades.find((g) => g.id === item.team_id)?.label} · {new Date(item.created_at).toLocaleDateString('es-PE')} · {({ pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' } as Record<string, string>)[item.status]}</small>
        <div className="identity-images">{Object.entries(item.assets).map(([kind, url]) => <a key={kind} href={`${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`} target="_blank" rel="noreferrer"><img src={`${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`} alt={kind === 'logo' ? 'Logo enviado' : 'Mascota enviada'} loading="lazy" /><span>{kind === 'logo' ? 'Logo' : 'Mascota'} · Abrir original</span></a>)}</div>
        <div className="identity-review-actions"><button disabled={busy || item.status === 'approved'} onClick={() => void decide(item, 'approved')}><Check size={15} /> Aprobar</button><button disabled={busy || item.status === 'rejected'} onClick={() => void decide(item, 'rejected')}><X size={15} /> Rechazar</button></div>
      </article>)}</div>
      {!items.some((i) => filter === 'all' || i.status === filter) && <p>No hay envíos en esta categoría.</p>}
    </div>
  </details>;
  return <details className="identity-upload" ref={detailsRef}>
    <summary><Upload size={14} /> Enviar logo o mascota</summary>
    <div className="identity-popover">
      <button className="identity-close" aria-label="Cerrar envío de logo o mascota" onClick={() => { if (detailsRef.current) detailsRef.current.open = false; }}><X size={17} /></button>
      <h3>Comparte la identidad de tu equipo</h3><p>{grade?.name} · {grade?.label}</p>
      <form ref={formRef} onSubmit={submit}>
        {(['logo', 'mascot'] as const).map((kind) => <label key={kind}><span>{kind === 'logo' ? <ImagePlus size={16} /> : <PawPrint size={16} />}{kind === 'logo' ? 'Logo del equipo' : 'Mascota del equipo'}</span><input type="file" accept="image/png,image/jpeg" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; setFiles((current) => { const next = { ...current }; if (file) next[kind] = file; else delete next[kind]; return next; }); }} /></label>)}
        <small>PNG o JPG · Hasta 2 MB por archivo.<br />Máximo por equipo: 20 logos y 20 mascotas.</small>
        {error && <p className="identity-error" role="alert">{error}</p>}{notice && <p className="identity-notice" role="status">{notice}</p>}
        <button className="button coral" disabled={busy || !Object.keys(files).length}>{busy ? 'Enviando…' : 'Enviar para revisión'}</button>
      </form>
      <footer>Solo el administrador puede aprobarlo. Enviar archivos no cambia el diseño actual.</footer>
    </div>
  </details>;
}
