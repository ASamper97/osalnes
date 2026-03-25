'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Locale } from '@/i18n/config';

const AssistantChat = dynamic(() => import('./AssistantChat').then((m) => ({ default: m.AssistantChat })), {
  ssr: false,
});

interface AssistantFABProps {
  lang: Locale;
  dict: Record<string, string>;
}

export function AssistantFAB({ lang, dict }: AssistantFABProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB button */}
      {!open && (
        <button
          className="assistant-fab"
          onClick={() => setOpen(true)}
          aria-label={dict.assistant_open || 'Abrir asistente turistico'}
          title={dict.assistant_open || 'Abrir asistente turistico'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="assistant-overlay" onClick={() => setOpen(false)}>
          <div className="assistant-drawer" onClick={(e) => e.stopPropagation()}>
            <AssistantChat lang={lang} dict={dict} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
