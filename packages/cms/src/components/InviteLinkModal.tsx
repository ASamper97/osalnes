import { useState, useEffect, useRef } from 'react';

/**
 * InviteLinkModal — Modal con el enlace de invitacion para copiar
 *
 * Se muestra tras crear un usuario nuevo o reenviar invitacion.
 * El admin copia el enlace y se lo envia al usuario por el canal
 * que prefiera (WhatsApp, email manual, presencial...).
 *
 * Esto evita la dependencia de SMTP transaccional.
 */

interface InviteLinkModalProps {
  open: boolean;
  link: string | null;
  email: string;
  userName?: string;
  onClose: () => void;
}

export function InviteLinkModal({ open, link, email, userName, onClose }: InviteLinkModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset copied state when modal opens
  useEffect(() => {
    if (open) {
      setCopied(false);
      setCopyError(null);
    }
  }, [open]);

  // Auto-select link text on open for easy manual copy
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.select(), 200);
    }
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  async function handleCopy() {
    if (!link) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Clipboard API blocked (insecure context, permissions, etc.)
      // Select the input so the user can copy manually with Ctrl+C
      inputRef.current?.select();
      setCopyError('Tu navegador bloqueo la copia automatica. El enlace ya esta seleccionado: pulsa Ctrl+C para copiarlo.');
    }
  }

  function handleWhatsApp() {
    if (!link) return;
    const text = `Hola ${userName || ''}!\n\nHas sido invitado al CMS de O Salnes. Configura tu contraseña en este enlace (caduca en 24h):\n\n${link}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  function handleMailto() {
    if (!link) return;
    const subject = 'Invitacion al CMS de O Salnes';
    const body = `Hola ${userName || ''},\n\nHas sido invitado al CMS de O Salnes. Para activar tu cuenta y configurar tu contraseña, abre este enlace en tu navegador (caduca en 24h):\n\n${link}\n\nUn saludo.`;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Open in a hidden iframe-like trigger so the modal stays open and the
    // mail client opens in a separate window/tab. window.open with mailto: is
    // blocked by some browsers, so we use a transient anchor click instead.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!open) return null;

  return (
    <>
      <div className="invite-modal__backdrop" onClick={onClose} role="presentation" />
      <div className="invite-modal" role="dialog" aria-labelledby="invite-modal-title">
        <div className="invite-modal__icon">🔗</div>
        <h2 id="invite-modal-title" className="invite-modal__title">
          Enlace de invitacion generado
        </h2>
        <p className="invite-modal__intro">
          Copia el enlace y enviaselo a <strong>{email}</strong> por el medio que prefieras.
          El usuario lo abrira en su navegador y configurara su propia contrasena.
        </p>

        {link ? (
          <>
            <div className="invite-modal__link-row">
              <input
                ref={inputRef}
                type="text"
                className="invite-modal__link-input"
                value={link}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                className={`btn btn-primary invite-modal__copy ${copied ? 'is-copied' : ''}`}
                onClick={handleCopy}
              >
                {copied ? '✓ Copiado' : '📋 Copiar'}
              </button>
            </div>

            {copyError && (
              <div className="alert alert-warning" style={{ marginBottom: '0.85rem', fontSize: '0.78rem' }}>
                {copyError}
              </div>
            )}

            <div className="invite-modal__shortcuts">
              <span className="invite-modal__shortcuts-label">Compartir directamente:</span>
              <button type="button" className="btn btn-sm" onClick={handleWhatsApp}>
                💬 WhatsApp
              </button>
              <button type="button" className="btn btn-sm" onClick={handleMailto}>
                ✉️ Cliente de email
              </button>
            </div>

            <div className="invite-modal__warning">
              <span>⚠️</span>
              <div>
                <strong>El enlace caduca en 24 horas.</strong>
                <p>Si tarda mas, puedes generar uno nuevo desde el boton "Invitar" en la lista de usuarios.</p>
              </div>
            </div>
          </>
        ) : (
          <div className="alert alert-error">
            No se pudo generar el enlace. Intenta crear el usuario de nuevo.
          </div>
        )}

        <div className="invite-modal__footer">
          <button type="button" className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </>
  );
}
