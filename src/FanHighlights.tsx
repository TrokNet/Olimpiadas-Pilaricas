import { useEffect, useState } from 'react';
import { ArrowRight, Heart, MessageCircle } from 'lucide-react';
import type { Grade } from './types';
import './engagement.css';

type Message = { id: string; team_id: string; author: string; message: string };
export default function FanHighlights({ grades }: { grades: Grade[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}api/fans?limit=3`, { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((feed: { messages: Message[] }) => setMessages(feed.messages))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return <section className="fan-highlights">
    <div className="fan-highlights-heading">
      <div><span className="eyebrow coral-text"><Heart size={14} /> MENSAJES DE LA TRIBUNA</span><h2>El aliento también se comparte.</h2></div>
      <a className="fan-wall-link" href="#fans">Escribe el tuyo <ArrowRight size={16} /></a>
    </div>
    {messages.length ? <div className="fan-highlight-list">{messages.map((message) => {
      const grade = grades.find((item) => item.id === message.team_id);
      return <article key={message.id}><MessageCircle size={19} /><p>“{message.message}”</p><span>{message.author} <b>para {grade?.name ?? 'su equipo'}</b></span></article>;
    })}</div> : <a className="fan-highlight-empty" href="#fans"><Heart size={20} /><span>Deja el primer mensaje y enciende la tribuna.</span><ArrowRight size={16} /></a>}
  </section>;
}
