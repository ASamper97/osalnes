import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ResourceSummary, type CategoryItem, type PageItem, type ProductItem } from '@/lib/api';

/**
 * GlobalSearch — Modal de busqueda tipo Spotlight / Linear / Notion
 *
 * Se abre con Cmd+K (Mac) o Ctrl+K (Windows). Permite buscar:
 * - Recursos turisticos
 * - Categorias
 * - Paginas editoriales
 * - Productos
 * - Acciones rapidas (navegacion)
 *
 * Navegacion con flechas + Enter, ESC para cerrar.
 */

interface SearchResult {
  id: string;
  type: 'resource' | 'category' | 'page' | 'product' | 'action';
  title: string;
  subtitle?: string;
  icon: string;
  link: string;
}

const QUICK_ACTIONS: SearchResult[] = [
  { id: 'action-new-resource', type: 'action', title: 'Crear nuevo recurso', subtitle: 'Asistente paso a paso', icon: '+', link: '/resources/new' },
  { id: 'action-new-page',     type: 'action', title: 'Crear nueva pagina',  subtitle: 'Asistente editorial',  icon: '+', link: '/pages/new' },
  { id: 'action-new-category', type: 'action', title: 'Crear nueva categoria', subtitle: 'Con preview del arbol', icon: '+', link: '/categories/new' },
  { id: 'action-new-product',  type: 'action', title: 'Crear nuevo producto', subtitle: 'Ruta o experiencia',     icon: '+', link: '/products/new' },
  { id: 'action-dashboard',    type: 'action', title: 'Ir al Dashboard', icon: '📊', link: '/' },
  { id: 'action-resources',    type: 'action', title: 'Ver lista de recursos', icon: '🏖️', link: '/resources' },
  { id: 'action-pages',        type: 'action', title: 'Ver lista de paginas', icon: '📄', link: '/pages' },
  { id: 'action-categories',   type: 'action', title: 'Ver categorias', icon: '🌳', link: '/categories' },
  { id: 'action-zones',        type: 'action', title: 'Ver mapa de zonas', icon: '📍', link: '/zones' },
  { id: 'action-exports',      type: 'action', title: 'Ir a exportaciones', icon: '📤', link: '/exports' },
  { id: 'action-users',        type: 'action', title: 'Gestionar usuarios', icon: '👥', link: '/users' },
];

const TYPE_LABELS: Record<string, string> = {
  resource: 'Recurso',
  category: 'Categoria',
  page: 'Pagina',
  product: 'Producto',
  action: 'Accion rapida',
};

const TYPE_ICONS: Record<string, string> = {
  resource: '🏖️',
  category: '🌳',
  page: '📄',
  product: '🎯',
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load all entities once when opened (for instant client-side search)
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.getResources({ limit: '100' }).then((r) => r.items).catch(() => []),
      api.getCategories().catch(() => []),
      api.getAdminPages().catch(() => []),
      api.getProducts().catch(() => []),
    ])
      .then(([r, c, p, pr]) => {
        setResources(r);
        setCategories(c);
        setPages(p);
        setProducts(pr);
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  // Build searchable index
  const allItems = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [...QUICK_ACTIONS];

    for (const r of resources) {
      items.push({
        id: `resource-${r.id}`,
        type: 'resource',
        title: r.name?.es || r.name?.gl || r.slug,
        subtitle: r.slug,
        icon: TYPE_ICONS.resource,
        link: `/resources/${r.id}`,
      });
    }

    for (const c of categories) {
      items.push({
        id: `category-${c.id}`,
        type: 'category',
        title: c.name?.es || c.slug,
        subtitle: c.parentId ? 'Subcategoria' : 'Categoria raiz',
        icon: TYPE_ICONS.category,
        link: `/categories/${c.id}/edit`,
      });
    }

    for (const p of pages) {
      items.push({
        id: `page-${p.id}`,
        type: 'page',
        title: p.title?.es || p.slug,
        subtitle: `${p.template || 'default'} · ${p.status}`,
        icon: TYPE_ICONS.page,
        link: `/pages/${p.id}/edit`,
      });
    }

    for (const p of products) {
      items.push({
        id: `product-${p.id}`,
        type: 'product',
        title: p.name?.es || p.slug,
        subtitle: p.activo ? 'Activo' : 'Inactivo',
        icon: TYPE_ICONS.product,
        link: `/products/${p.id}/edit`,
      });
    }

    return items;
  }, [resources, categories, pages, products]);

  // Fuzzy search (simple substring + score by position)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Return only quick actions when empty
      return allItems.filter((i) => i.type === 'action').slice(0, 8);
    }

    const scored = allItems
      .map((item) => {
        const titleLower = item.title.toLowerCase();
        const subtitleLower = (item.subtitle || '').toLowerCase();

        if (titleLower === q) return { item, score: 100 };
        if (titleLower.startsWith(q)) return { item, score: 90 };
        if (titleLower.includes(q)) return { item, score: 70 };
        if (subtitleLower.startsWith(q)) return { item, score: 50 };
        if (subtitleLower.includes(q)) return { item, score: 30 };
        return null;
      })
      .filter((x): x is { item: SearchResult; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return scored.map((x) => x.item);
  }, [query, allItems]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  const handleSelect = useCallback((item: SearchResult) => {
    navigate(item.link);
    onClose();
  }, [navigate, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) handleSelect(item);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, selectedIndex, handleSelect, onClose]);

  if (!open) return null;

  // Group results by type for display
  const grouped = filtered.reduce<Record<string, SearchResult[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  let runningIndex = 0;

  return (
    <>
      <div className="global-search__backdrop" onClick={onClose} role="presentation" />
      <div className="global-search" role="dialog" aria-label="Busqueda global">
        <div className="global-search__input-wrapper">
          <span className="global-search__icon">🔍</span>
          <input
            ref={inputRef}
            type="search"
            className="global-search__input"
            placeholder="Buscar recursos, paginas, categorias, productos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Busqueda global"
          />
          <kbd className="global-search__kbd">ESC</kbd>
        </div>

        <div className="global-search__results">
          {loading && filtered.length === 0 && (
            <p className="global-search__empty">Cargando...</p>
          )}

          {!loading && filtered.length === 0 && (
            <p className="global-search__empty">
              {query ? 'Sin resultados para tu busqueda' : 'Empieza a escribir...'}
            </p>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="global-search__group">
              <h4 className="global-search__group-title">{TYPE_LABELS[type] || type}</h4>
              {items.map((item) => {
                const idx = runningIndex++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`global-search__item ${isSelected ? 'global-search__item--selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="global-search__item-icon">{item.icon}</span>
                    <div className="global-search__item-text">
                      <strong>{item.title}</strong>
                      {item.subtitle && <span>{item.subtitle}</span>}
                    </div>
                    {isSelected && <kbd className="global-search__item-enter">↵</kbd>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="global-search__footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> Navegar</span>
          <span><kbd>↵</kbd> Abrir</span>
          <span><kbd>ESC</kbd> Cerrar</span>
        </div>
      </div>
    </>
  );
}
