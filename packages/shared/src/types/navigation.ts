import type { LocalizedValue } from './resource.js';

/** Item de navegacion */
export interface NavigationItem {
  id: string;
  menuSlug: string;
  parentId: string | null;
  type: 'pagina' | 'recurso' | 'url_externa' | 'categoria' | 'tipologia';
  reference: string | null;
  label: LocalizedValue;
  order: number;
  visible: boolean;
  children?: NavigationItem[];
}
