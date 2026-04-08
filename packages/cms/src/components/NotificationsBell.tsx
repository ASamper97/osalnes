import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, formatRelativeTime, type NotificationType } from '@/lib/notifications';

/**
 * NotificationsBell — Icono de campana en el sidebar con dropdown panel
 */

const TYPE_ICONS: Record<NotificationType, string> = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠️',
  error: '✕',
};

const TYPE_COLORS: Record<NotificationType, string> = {
  info: '#3498db',
  success: '#27ae60',
  warning: '#f39c12',
  error: '#c0392b',
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, remove, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside closes the panel
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    // Delay registration so the opening click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  function handleClick(notifId: string, link?: string) {
    markAsRead(notifId);
    if (link) {
      navigate(link);
      setOpen(false);
    }
  }

  return (
    <div className="notif-bell-wrapper" ref={panelRef}>
      <button
        type="button"
        className="notif-bell"
        onClick={() => setOpen(!open)}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
        title="Notificaciones"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notif-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Panel de notificaciones">
          <div className="notif-panel__header">
            <strong>Notificaciones</strong>
            <div className="notif-panel__header-actions">
              {unreadCount > 0 && (
                <button type="button" className="notif-panel__action" onClick={markAllAsRead}>
                  Marcar todas leidas
                </button>
              )}
              {notifications.length > 0 && (
                <button type="button" className="notif-panel__action" onClick={clear}>
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="notif-panel__list">
            {notifications.length === 0 ? (
              <div className="notif-panel__empty">
                <span>📭</span>
                <p>No hay notificaciones todavia</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item notif-item--${n.type} ${!n.read ? 'notif-item--unread' : ''} ${n.link ? 'notif-item--clickable' : ''}`}
                  onClick={() => n.link && handleClick(n.id, n.link)}
                >
                  <span
                    className="notif-item__icon"
                    style={{ background: TYPE_COLORS[n.type] }}
                  >
                    {TYPE_ICONS[n.type]}
                  </span>
                  <div className="notif-item__content">
                    <strong>{n.title}</strong>
                    {n.message && <p>{n.message}</p>}
                    <span className="notif-item__time">{formatRelativeTime(n.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    className="notif-item__remove"
                    onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                    aria-label="Eliminar notificacion"
                  >×</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
