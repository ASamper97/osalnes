'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';

const ASSISTANT_URL = process.env.NEXT_PUBLIC_ASSISTANT_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assistant`
    : 'http://localhost:54321/functions/v1/assistant';

interface SuggestedResource {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  municipio: string;
  lat: number | null;
  lng: number | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  recursos?: SuggestedResource[];
}

interface AssistantChatProps {
  lang: Locale;
  dict: Record<string, string>;
  onClose: () => void;
}

export function AssistantChat({ lang, dict, onClose }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;

    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(ASSISTANT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, lang, history, session_id: sessionId }),
      });

      if (!res.ok) throw new Error('Error del asistente');

      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.reply,
        recursos: data.recursos_sugeridos,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: dict.assistant_error || 'Lo siento, ha ocurrido un error. Intentalo de nuevo.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="assistant-panel" role="dialog" aria-label={dict.assistant_title || 'Asistente turistico'}>
      {/* Header */}
      <div className="assistant-header">
        <div>
          <strong>{dict.assistant_title || 'Asistente turistico'}</strong>
          <span className="assistant-subtitle">{dict.assistant_subtitle || 'O Salnes DTI'}</span>
        </div>
        <button onClick={onClose} className="assistant-close" aria-label={dict.close || 'Cerrar'}>
          &times;
        </button>
      </div>

      {/* Messages */}
      <div className="assistant-messages" ref={scrollRef} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="assistant-welcome">
            <p>{dict.assistant_welcome || 'Hola! Soy tu guia turistico de O Salnes. Preguntame lo que quieras sobre la comarca.'}</p>
            <div className="assistant-suggestions">
              {[
                dict.assistant_suggestion_1 || 'Que puedo hacer en Cambados?',
                dict.assistant_suggestion_2 || 'Recomiendame playas en Sanxenxo',
                dict.assistant_suggestion_3 || 'Donde comer bien con vistas al mar?',
              ].map((s) => (
                <button key={s} className="assistant-suggestion-btn" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`assistant-msg assistant-msg--${msg.role}`}>
            <div className="assistant-msg__bubble">
              {msg.content}
            </div>
            {msg.recursos && msg.recursos.length > 0 && (
              <div className="assistant-resources">
                {msg.recursos.map((r) => (
                  <Link
                    key={r.id}
                    href={`/${lang}/recurso/${r.slug}`}
                    className="assistant-resource-card"
                  >
                    <span className="assistant-resource-card__type">{r.tipo}</span>
                    <span className="assistant-resource-card__name">{r.nombre}</span>
                    <span className="assistant-resource-card__muni">{r.municipio}</span>
                    {r.lat && r.lng && (
                      <Link
                        href={`/${lang}/mapa?lat=${r.lat}&lng=${r.lng}&zoom=15`}
                        className="assistant-resource-card__map"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {dict.see_on_map || 'Ver en mapa'}
                      </Link>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="assistant-msg assistant-msg--assistant">
            <div className="assistant-msg__bubble assistant-thinking">
              {dict.assistant_thinking || 'Pensando...'}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form className="assistant-input" onSubmit={handleSubmit}>
        <label htmlFor="assistant-input" className="sr-only">{dict.assistant_placeholder || 'Escribe tu pregunta...'}</label>
        <input
          ref={inputRef}
          id="assistant-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={dict.assistant_placeholder || 'Escribe tu pregunta...'}
          disabled={loading}
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !input.trim()} aria-label={dict.send || 'Enviar'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
