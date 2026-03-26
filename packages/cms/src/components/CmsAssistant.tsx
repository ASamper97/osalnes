'use client';
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Context-aware suggestions based on current page
function getSuggestions(path: string): string[] {
  if (path.includes('/resources/') && path !== '/resources/new') {
    return [
      'Mejora la descripcion de este recurso',
      'Traduce el nombre y descripcion a gallego',
      'Sugiere un titulo SEO optimizado',
      'Que informacion le falta a este recurso?',
    ];
  }
  if (path === '/resources/new') {
    return [
      'Escribe una descripcion turistica de una playa',
      'Que campos son obligatorios para un recurso?',
      'Sugiere tipos de turista para un restaurante',
      'Ayudame a rellenar los datos de un hotel',
    ];
  }
  if (path === '/' || path === '') {
    return [
      'Como puedo mejorar la calidad de los datos?',
      'Que indicadores UNE 178502 debemos mejorar?',
      'Cuantos recursos nos faltan por completar?',
      'Sugiere contenido para atraer mas turistas',
    ];
  }
  return [
    'Escribe una descripcion turistica de una playa gallega',
    'Traduce al gallego: "Restaurante con vistas al mar"',
    'Sugiere un titulo SEO para un hotel en Sanxenxo',
  'Que informacion deberia tener un recurso turistico completo?',
  ];
}

export function CmsAssistant() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestions = getSuggestions(location.pathname);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cms-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          message: msg,
          context: { page: location.pathname },
          history: messages.slice(-8),
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'Sin respuesta';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error de conexion con el asistente.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* FAB button */}
      <button
        className="cms-ai-fab"
        onClick={() => setOpen(!open)}
        title="ARIA"
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="cms-ai-panel">
          <div className="cms-ai-header">
            <span className="cms-ai-header__dot" />
            <strong>ARIA</strong>
            <span style={{ fontSize: '0.65rem', color: '#1abc9c', fontWeight: 500 }}>A Ria + IA</span>
          </div>

          <div className="cms-ai-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="cms-ai-welcome">
                <p style={{ marginBottom: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>Ola! Son ARIA</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--cms-text-light)', marginBottom: '1rem' }}>
                  A tua asistente intelixente de O Salnes. Podo escribir descricions, traducir, optimizar SEO ou responder preguntas.
                </p>
                <div className="cms-ai-suggestions">
                  {suggestions.map((s, i) => (
                    <button key={i} className="cms-ai-suggestion" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`cms-ai-msg cms-ai-msg--${m.role}`}>
                <div className="cms-ai-msg__bubble">
                  {m.content.split('\n').map((line, j) => (
                    <p key={j} style={{ margin: line ? '0.25rem 0' : 0 }}>{line}</p>
                  ))}
                </div>
              </div>
            ))}

            {loading && (
              <div className="cms-ai-msg cms-ai-msg--assistant">
                <div className="cms-ai-msg__bubble cms-ai-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <form className="cms-ai-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta a ARIA..."
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading || !input.trim()}>Enviar</button>
          </form>
        </div>
      )}
    </>
  );
}
