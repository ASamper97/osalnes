/**
 * useBeforeUnload — avisar al usuario si intenta cerrar/navegar con
 * cambios sin guardar.
 *
 * Aprovecha el event `beforeunload` del navegador. El texto personalizado
 * ya no se respeta en navegadores modernos (por seguridad), pero sí se
 * muestra el aviso genérico tipo "¿Quieres salir de esta página?".
 *
 * Uso:
 *
 *   useBeforeUnload(hasUnsavedChanges, 'Tienes cambios sin guardar.');
 */

import { useEffect } from 'react';

export function useBeforeUnload(
  enabled: boolean,
  message = 'Tienes cambios sin guardar. ¿Seguro que quieres salir?',
): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: BeforeUnloadEvent) => {
      // Chrome/Firefox/Safari modernos ignoran el texto personalizado
      // y muestran su mensaje genérico. Los navegadores antiguos sí lo
      // muestran.
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [enabled, message]);
}
