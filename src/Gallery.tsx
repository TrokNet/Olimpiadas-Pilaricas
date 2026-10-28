import { useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, ShieldCheck, Trash2, Upload } from 'lucide-react';
import type { FormEvent } from 'react';
import type { Tournament } from './types';
import './engagement.css';

type Photo = { id: string; team_id: string; caption: string; content_type: string; status: string; created_at: string; image_url: string };
async function jsonResponse(response: Response) {
  let body: Record<string, unknown> = {};
  try { body = await response.json(); } catch { /* Give a clear static-hosting message below. */ }
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'No se pudo completar la solicitud.');
  return body;
}
function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function Gallery({ data, initialTeamId = '' }: { data: Tournament; initialTeamId?: string }) {
  const [team, setTeam] = useState(initialTeamId);
  const [filter, setFilter] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pending, setPending] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const isAdmin = data.auth_user?.role === 'admin';
  const teamMap = useMemo(() => new Map(data.grades.map((grade) => [grade.id, grade])), [data.grades]);

  const loadPhotos = async () => {
    const params = new URLSearchParams(); if (filter) params.set('team_id', filter);
    const body = await jsonResponse(await fetch(`${import.meta.env.BASE_URL}api/gallery?${params}`, { cache: 'no-store' }));
    setPhotos(Array.isArray(body.photos) ? body.photos as Photo[] : []);
  };
  const loadPending = async () => {
    if (!isAdmin) return;
    const body = await jsonResponse(await fetch(`${import.meta.env.BASE_URL}api/gallery/review`, { cache: 'no-store' }));
    setPending(Array.isArray(body.photos) ? body.photos as Photo[] : []);
  };
  useEffect(() => { void loadPhotos().catch(() => setError('No se pudo cargar la galería.')); }, [filter]);
  useEffect(() => { if (isAdmin) void loadPending().catch(() => setError('No se pudo cargar la revisión de fotos.')); }, [isAdmin]);

  const upload = async (event: FormEvent) => {
    event.preventDefault(); if (!file || !team) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Elige una foto JPG o PNG.'); return; }
    if (file.size > 3 * 1024 * 1024) { setError('La imagen debe pesar hasta 3 MB.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const image = await readFile(file);
      const body = await jsonResponse(await fetch(`${import.meta.env.BASE_URL}api/gallery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_id: team, caption: caption.trim(), image }) }));
      setNotice(String(body.message || 'Foto enviada para revisión.')); setFile(null); setCaption('');
      const input = document.getElementById('gallery-photo-file') as HTMLInputElement | null; if (input) input.value = '';
      if (isAdmin) await loadPending();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar la foto.'); }
    finally { setBusy(false); }
  };

  const review = async (photo: Photo, status: 'approved' | 'rejected') => {
    setBusy(true); setError('');
    try {
      await jsonResponse(await fetch(`${import.meta.env.BASE_URL}api/gallery/${encodeURIComponent(photo.id)}/review`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }));
      setPending((current) => current.filter((item) => item.id !== photo.id));
      setNotice(status === 'approved' ? 'Foto publicada en la galería.' : 'Foto rechazada.');
      if (status === 'approved') await loadPhotos();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo revisar la foto.'); }
    finally { setBusy(false); }
  };

  return <section className="gallery-section">
    <header className="community-section-heading">
      <div><span className="eyebrow coral-text"><ImagePlus size={14} /> ÁLBUM DE LA HINCHADA</span><h2>La jornada, en imágenes.</h2><p>Comparte una foto del torneo; primero la revisaremos antes de publicarla.</p></div>
      <label className="prediction-filter"><span className="sr-only">Filtrar fotos por equipo</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todos los equipos</option>{data.grades.map((grade) => <option value={grade.id} key={grade.id}>{grade.name}</option>)}</select></label>
    </header>
    <form className="gallery-upload" onSubmit={upload}>
      <label><span>Equipo</span><select required value={team} onChange={(event) => setTeam(event.target.value)}><option value="">Elige tu equipo</option>{data.grades.map((grade) => <option value={grade.id} key={grade.id}>{grade.name} · {grade.label}</option>)}</select></label>
      <label className="gallery-caption"><span>Pie de foto <small>(opcional)</small></span><input maxLength={120} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Un recuerdo de la jornada" /></label>
      <label className="gallery-file"><input id="gallery-photo-file" type="file" accept="image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} /><ImagePlus size={17} />{file ? file.name : 'Elegir foto'}</label>
      <button className="button coral" disabled={busy || !team || !file}>{busy ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />} Enviar</button>
    </form>
    {notice && <p className="gallery-notice" role="status">{notice}</p>}{error && <p className="gallery-error" role="alert">{error}</p>}
    {isAdmin && <div className="gallery-moderation"><div className="gallery-moderation-title"><ShieldCheck size={18} /><b>Fotos por revisar</b><span>{pending.length}</span></div>{pending.length ? <div className="gallery-pending-grid">{pending.map((photo) => <article key={photo.id}><img src={`${import.meta.env.BASE_URL}${photo.image_url.replace(/^\//, '')}`} alt="Foto pendiente de revisión" /><div><strong>{teamMap.get(photo.team_id)?.name}</strong><p>{photo.caption || 'Sin pie de foto'}</p><button disabled={busy} onClick={() => void review(photo, 'approved')}><Check size={15} /> Publicar</button><button disabled={busy} onClick={() => void review(photo, 'rejected')}><Trash2 size={15} /> Rechazar</button></div></article>)}</div> : <p>No hay fotos pendientes.</p>}</div>}
    {photos.length ? <div className="gallery-grid">{photos.map((photo) => <figure key={photo.id}><img loading="lazy" src={`${import.meta.env.BASE_URL}${photo.image_url.replace(/^\//, '')}`} alt={photo.caption || `Foto de ${teamMap.get(photo.team_id)?.name || 'las Olimpiadas'}`} /><figcaption><span>{teamMap.get(photo.team_id)?.name || 'Olimpiadas 2026'}</span>{photo.caption && <p>{photo.caption}</p>}</figcaption></figure>)}</div> : <div className="gallery-empty"><ImagePlus size={25} /><span>El álbum está listo. Comparte la primera foto de la jornada.</span></div>}
  </section>;
}
