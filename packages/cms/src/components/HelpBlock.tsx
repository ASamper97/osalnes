/**
 * HelpBlock — bloque pedagógico plegable
 *
 * Se muestra expandido por defecto en cada paso del wizard. El usuario
 * puede ocultarlo con el botón interno; la preferencia se recuerda en
 * localStorage por `storageKey` para que la próxima sesión lo respete.
 *
 * Principio: el usuario infrecuente (<5 recursos/mes) se beneficia de
 * la ayuda visible por defecto. El usuario frecuente la oculta una vez
 * y no la vuelve a ver.
 */

import { useEffect, useState, type ReactNode } from 'react';

export interface HelpBlockProps {
  storageKey: string;
  title: string;
  toggleHideLabel: string;
  toggleShowLabel: string;
  children: ReactNode;
}

function readPreference(storageKey: string): boolean {
  try {
    return localStorage.getItem(`help-block:${storageKey}`) !== 'hidden';
  } catch {
    return true;
  }
}

function writePreference(storageKey: string, open: boolean) {
  try {
    localStorage.setItem(`help-block:${storageKey}`, open ? 'visible' : 'hidden');
  } catch {
    // silent
  }
}

export default function HelpBlock({
  storageKey,
  title,
  toggleHideLabel,
  toggleShowLabel,
  children,
}: HelpBlockProps) {
  const [open, setOpen] = useState<boolean>(true);

  useEffect(() => {
    setOpen(readPreference(storageKey));
  }, [storageKey]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    writePreference(storageKey, next);
  };

  if (!open) {
    return (
      <button type="button" className="help-block-toggle" onClick={toggle}>
        <span className="help-block-toggle-icon" aria-hidden>
          💡
        </span>
        <span>{toggleShowLabel}</span>
      </button>
    );
  }

  return (
    <section className="help-block" aria-label={title}>
      <header className="help-block-header">
        <span className="help-block-icon" aria-hidden>
          💡
        </span>
        <h3 className="help-block-title">{title}</h3>
        <button
          type="button"
          className="help-block-hide"
          onClick={toggle}
          aria-label={toggleHideLabel}
        >
          {toggleHideLabel}
        </button>
      </header>
      <div className="help-block-body">{children}</div>
    </section>
  );
}
