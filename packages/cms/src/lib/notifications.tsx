import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

/**
 * Notifications — Sistema simple de notificaciones in-app
 *
 * Sin BBDD, persistencia en localStorage. Cada usuario tiene sus
 * notificaciones guardadas localmente. Apto para avisos editoriales,
 * confirmaciones de acciones, errores, etc.
 *
 * Uso:
 *   const { notify } = useNotifications();
 *   notify({ type: 'success', title: 'Publicado', message: 'El recurso X esta en la web' });
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  createdAt: number;
}

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  notify: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const STORAGE_KEY = 'osalnes_notifications';
const MAX_NOTIFICATIONS = 50;

function loadFromStorage(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(notifications: Notification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch { /* ignore quota errors */ }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => loadFromStorage());

  // Persist whenever notifications change
  useEffect(() => {
    saveToStorage(notifications);
  }, [notifications]);

  const notify = useCallback((n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...n,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: Date.now(),
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, notify, markAsRead, markAllAsRead, remove, clear }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    // Fallback: no-op functions if provider missing
    return {
      notifications: [],
      unreadCount: 0,
      notify: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      remove: () => {},
      clear: () => {},
    };
  }
  return ctx;
}

/** Format timestamp as relative time */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  if (hour < 24) return `Hace ${hour}h`;
  if (day < 7) return `Hace ${day}d`;
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
