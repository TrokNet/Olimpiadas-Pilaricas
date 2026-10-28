import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { CalendarDays, Copy, Download, QrCode, Share2, X } from 'lucide-react';
import type { Grade, Match, Tournament } from './types';
import { COLOR, SPORTS } from './types';
import { dayLabel, matchName, timestamp } from './lib';
import { Modal } from './ui';
import './engagement.css';

function sportLabel(sport: string) {
  return SPORTS.find((item) => item.id === sport)?.label ?? 'Básquet';
}

function makeTeamUrl(grade: Grade) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = `equipo/${grade.id}`;
  return url.href;
}

function posterBlob(grade: Grade, matches: Match[], data: Tournament, url: string) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext('2d');
    if (!context) return reject(new Error('No se pudo preparar el afiche.'));
    const accent = COLOR[grade.color] || '#ff6b61';
    const gradient = context.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, '#191919');
    gradient.addColorStop(1, '#090909');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1080, 1350);
    context.fillStyle = accent;
    context.fillRect(0, 0, 18, 1350);
    context.fillStyle = '#ffffff';
    context.font = '600 28px Arial';
    context.letterSpacing = '5px';
    context.fillText('OLIMPIADAS PILARICAS 2026', 76, 104);
    context.fillStyle = accent;
    context.fillRect(76, 140, 120, 8);
    context.fillStyle = '#ffffff';
    context.font = 'bold 82px Arial';
    context.letterSpacing = '0px';
    const title = grade.name.toUpperCase();
    context.fillText(title, 76, 254, 900);
    context.fillStyle = accent;
    context.font = '600 34px Arial';
    context.fillText(grade.label.toUpperCase(), 80, 312);
    context.fillStyle = '#c8c8c8';
    context.font = '26px Arial';
    context.fillText('ESTE ES NUESTRO CAMINO', 80, 390);
    context.fillStyle = '#282828';
    context.fillRect(76, 426, 928, 2);

    const selected = matches.slice(0, 6);
    selected.forEach((match, index) => {
      const y = 500 + index * 122;
      context.fillStyle = accent;
      context.font = 'bold 24px Arial';
      context.fillText(`${dayLabel(match.date)} · ${match.start}`, 80, y);
      context.fillStyle = '#ffffff';
      context.font = 'bold 30px Arial';
      const opponent = match.home_id && data.entries.find((entry) => entry.id === match.home_id)?.grade_id === grade.id
        ? matchName(data, match.away_id, match.away_label)
        : matchName(data, match.home_id, match.home_label);
      context.fillText(`vs  ${opponent}`, 80, y + 43, 760);
      context.fillStyle = '#aaa';
      context.font = '21px Arial';
      context.fillText(`${sportLabel(match.sport)}  ·  ${match.court}`, 80, y + 78);
      context.fillStyle = '#303030';
      context.fillRect(80, y + 98, 920, 1);
    });
    context.fillStyle = accent;
    context.font = 'bold 30px Arial';
    context.fillText('¡VEN A ALENTAR!', 80, 1240);
    context.fillStyle = '#bdbdbd';
    context.font = '20px Arial';
    context.fillText(new URL(url).host, 80, 1282);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo generar el afiche.')), 'image/png');
  });
}

export default function TeamShare({ grade, matches, data, onNotice }: {
  grade: Grade;
  matches: Match[];
  data: Tournament;
  onNotice: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');
  const accent = COLOR[grade.color] || '#ff6b61';
  const url = useMemo(() => makeTeamUrl(grade), [grade]);
  const upcoming = useMemo(() => matches.filter((match) => match.kind === 'OFICIAL' && timestamp(match, true) >= Date.now()).slice(0, 6), [matches]);
  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 260, margin: 1, color: { dark: '#171717', light: '#ffffff' }, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [open, url]);

  const shareLink = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `Fixture de ${grade.name}`, text: `Acompaña a ${grade.name} en las Olimpiadas Pilaricas 2026`, url });
      else {
        await navigator.clipboard.writeText(url);
        onNotice('Enlace del equipo copiado.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) onNotice('No se pudo compartir el enlace.');
    }
  };

  const downloadPoster = async (share = false) => {
    try {
      const blob = await posterBlob(grade, upcoming, data, url);
      const file = new File([blob], `fixture-${grade.id}.png`, { type: 'image/png' });
      if (share && navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: `Fixture de ${grade.name}`, text: `¡Ven a alentar a ${grade.name}!`, files: [file], url });
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      onNotice('Afiche descargado. Ya puedes compartirlo.');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) onNotice('No se pudo crear el afiche.');
    }
  };

  return <>
    <button className="button coral team-share-trigger" onClick={() => setOpen(true)}><Share2 size={17} /> Comparte el fixture</button>
    <Modal open={open} onClose={() => setOpen(false)} title={`La hinchada de ${grade.name}`} description="Comparte sus partidos y ayuda a llenar las tribunas." className="team-share-modal">
      <div className="share-preview" style={{ '--share-accent': accent } as React.CSSProperties}>
        <div className="share-preview-copy">
          <span>OLIMPIADAS PILARICAS 2026</span>
          <h3>{grade.name}</h3>
          <p>{grade.label} · {upcoming.length} próximos partidos</p>
          <div className="share-actions">
            <button className="button coral" onClick={shareLink}><Share2 size={16} /> Compartir enlace</button>
            <button className="button outline" onClick={() => void downloadPoster(true)}><Download size={16} /> Compartir afiche</button>
            <button className="button outline" onClick={() => void downloadPoster()}><Download size={16} /> Descargar afiche</button>
          </div>
        </div>
        <div className="share-qr-wrap">
          {qr ? <img src={qr} alt={`Código QR al fixture de ${grade.name}`} /> : <QrCode size={42} />}
          <span>Escanea y alienta</span>
          <button className="share-copy" onClick={() => { void navigator.clipboard.writeText(url).then(() => onNotice('Enlace del equipo copiado.')); }}><Copy size={14} /> Copiar enlace</button>
        </div>
      </div>
      <div className="share-match-list">
        <div className="share-list-title"><CalendarDays size={16} /> Próximos encuentros</div>
        {upcoming.slice(0, 3).map((match) => {
          const ownIsHome = Boolean(match.home_id && data.entries.find((entry) => entry.id === match.home_id)?.grade_id === grade.id);
          const rival = ownIsHome ? matchName(data, match.away_id, match.away_label) : matchName(data, match.home_id, match.home_label);
          return <p key={match.id}><span>{dayLabel(match.date)} · {match.start}</span><b>{sportLabel(match.sport)}</b><strong>vs {rival}</strong></p>;
        })}
        {!upcoming.length && <p><span>Fixture disponible</span><b>Revisa el calendario</b></p>}
      </div>
      <button className="share-modal-close" onClick={() => setOpen(false)}><X size={16} /> Listo</button>
    </Modal>
  </>;
}
