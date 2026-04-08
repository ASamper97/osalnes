import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, type NavItem, type PageItem, type CategoryItem, type ResourceSummary } from '@/lib/api';
import { Wizard, WizardFieldGroup, WizardCompletionCard, type WizardStepDef } from '@/components/Wizard';
import { aiTranslate } from '@/lib/ai';

/**
 * NavigationWizardPage — Asistente "guia burros" para crear/editar items de menu.
 *
 * Resuelve la confusion del formulario plano:
 * - Que es "tipo: pagina" vs "tipo: recurso"
 * - Que poner en el campo "referencia" segun el tipo
 * - Como ordenar y agrupar items (parent/child)
 */

const MENUS = ['header', 'footer', 'sidebar'] as const;
type MenuSlug = typeof MENUS[number];

const MENU_INFO: Record<MenuSlug, { icon: string; name: string; desc: string }> = {
  header:  { icon: '🔝', name: 'Cabecera', desc: 'Menu principal en la parte superior de la web' },
  footer:  { icon: '🔻', name: 'Pie de pagina', desc: 'Enlaces secundarios al final de cada pagina' },
  sidebar: { icon: '◀️', name: 'Barra lateral', desc: 'Enlaces complementarios a un lado del contenido' },
};

const TIPOS = ['pagina', 'recurso', 'categoria', 'url_externa'] as const;
type Tipo = typeof TIPOS[number];

const TIPO_INFO: Record<Tipo, { icon: string; name: string; desc: string; example: string }> = {
  pagina:      { icon: '📄', name: 'Pagina editorial',  desc: 'Una pagina del portal (info-practica, sobre-nosotros, agenda...)', example: 'Informacion practica → /es/info-practica' },
  recurso:     { icon: '🏖️', name: 'Recurso turistico', desc: 'Un recurso concreto del catalogo (un hotel, una playa, un museo)',     example: 'Mirador A Lanzada → /es/recurso/mirador-a-lanzada' },
  categoria:   { icon: '🏷️', name: 'Categoria',         desc: 'Un grupo de recursos (Alojamientos, Restaurantes, Playas...)',         example: 'Alojamientos → /es/buscar?categoria=alojamientos' },
  url_externa: { icon: '🌐', name: 'URL externa',       desc: 'Un enlace a otra web (turismo.gal, redes sociales, etc.)',             example: 'https://turismo.gal' },
};

export function NavigationWizardPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !id;
  const navigate = useNavigate();

  // UI state
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);

  // Reference data (loaded from API)
  const [pages, setPages] = useState<PageItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [siblingItems, setSiblingItems] = useState<NavItem[]>([]);
  const [resourceSearch, setResourceSearch] = useState('');

  // Form state
  const initialMenu = (searchParams.get('menu') as MenuSlug) || 'header';
  const [menuSlug, setMenuSlug] = useState<MenuSlug>(initialMenu);
  const [tipo, setTipo] = useState<Tipo>('pagina');
  const [referencia, setReferencia] = useState('');
  const [labelEs, setLabelEs] = useState('');
  const [labelGl, setLabelGl] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelFr, setLabelFr] = useState('');
  const [labelPt, setLabelPt] = useState('');
  const [orden, setOrden] = useState('0');
  const [visible, setVisible] = useState(true);
  const [parentId, setParentId] = useState<string>('');

  // ── Data loading ────────────────────────────────────────

  useEffect(() => {
    api.getAdminPages().then(setPages).catch(() => {});
    api.getCategories().then(setCategories).catch(() => {});
    api.getResources({ limit: '100' }).then((r) => setResources(r.items)).catch(() => {});
  }, []);

  // Load sibling items for parent selection
  useEffect(() => {
    api.getAdminNavigation(menuSlug).then(setSiblingItems).catch(() => setSiblingItems([]));
  }, [menuSlug]);

  // Load existing item when editing
  useEffect(() => {
    if (isNew || !id) return;
    // Try each menu until we find the item
    Promise.all(MENUS.map((m) => api.getAdminNavigation(m).then((items) => ({ menu: m, items }))))
      .then((results) => {
        for (const { menu, items } of results) {
          const found = items.find((it) => it.id === id);
          if (found) {
            setMenuSlug(menu);
            setTipo((found.tipo as Tipo) || 'pagina');
            setReferencia(found.referencia || '');
            setLabelEs(found.label?.es || '');
            setLabelGl(found.label?.gl || '');
            setLabelEn(found.label?.en || '');
            setLabelFr(found.label?.fr || '');
            setLabelPt(found.label?.pt || '');
            setOrden(String(found.orden));
            setVisible(found.visible !== false);
            setParentId(found.parentId || '');
            setLoading(false);
            return;
          }
        }
        setError('No se encontro el elemento de navegacion');
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id, isNew]);

  // ── Helpers ──────────────────────────────────────────────

  async function handleTranslate(sourceText: string, targetLang: string, setter: (v: string) => void) {
    if (!sourceText.trim()) return;
    setTranslating(targetLang);
    try {
      const result = await aiTranslate(sourceText, 'es', targetLang);
      setter(result);
    } catch {
      // silent
    } finally {
      setTranslating(null);
    }
  }

  // ── Validation per step ────────────────────────────────

  const validateStep1 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!menuSlug) errs.push('Selecciona donde colocar el enlace');
    return errs;
  }, [menuSlug]);

  const validateStep2 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!tipo) errs.push('Selecciona el tipo de enlace');
    if (tipo === 'url_externa') {
      if (!referencia.trim()) errs.push('Pon la URL completa');
      else if (!/^https?:\/\//.test(referencia)) errs.push('La URL debe empezar por http:// o https://');
    } else {
      if (!referencia.trim()) errs.push('Selecciona el destino del enlace');
    }
    return errs;
  }, [tipo, referencia]);

  const validateStep3 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!labelEs.trim()) errs.push('La etiqueta en castellano es obligatoria');
    if (labelEs.length > 30) errs.push('La etiqueta es demasiado larga (max 30 caracteres recomendado)');
    return errs;
  }, [labelEs]);

  // ── Step definitions ───────────────────────────────────

  const steps: WizardStepDef[] = [
    {
      id: 'menu',
      title: 'Donde',
      subtitle: 'En que menu va el enlace',
      icon: '📍',
      help: 'Elige en que menu del portal aparecera este enlace. La cabecera es lo mas visible, el pie suele tener enlaces secundarios.',
      validate: validateStep1,
    },
    {
      id: 'tipo',
      title: 'Que enlazas',
      subtitle: 'Tipo y destino',
      icon: '🔗',
      help: 'Decide a donde lleva el enlace. Puedes apuntar a una pagina del portal, a un recurso turistico concreto, a una categoria de recursos o a una web externa.',
      validate: validateStep2,
    },
    {
      id: 'etiquetas',
      title: 'Etiquetas',
      subtitle: 'Texto del enlace en cada idioma',
      icon: '🏷️',
      help: 'El texto que el visitante vera en el menu. Mantenlo corto (1-3 palabras). Puedes traducir automaticamente con IA a los demas idiomas.',
      validate: validateStep3,
    },
    {
      id: 'opciones',
      title: 'Opciones',
      subtitle: 'Orden, visibilidad, agrupacion',
      icon: '⚙️',
      help: 'Configura el orden en el menu (0 = primero), si esta visible y si pertenece a un submenu de otro item.',
      optional: true,
    },
    {
      id: 'revision',
      title: 'Revision',
      subtitle: 'Confirmar y guardar',
      icon: '✅',
      help: 'Revisa todos los datos antes de crear el enlace.',
    },
  ];

  // ── Save / Submit ──────────────────────────────────────

  async function handleFinish() {
    setError(null);
    setSaving(true);

    const body = {
      menu_slug: menuSlug,
      tipo,
      referencia: referencia || null,
      orden: parseInt(orden, 10) || 0,
      visible,
      parent_id: parentId || null,
      label: {
        es: labelEs,
        gl: labelGl,
        ...(labelEn && { en: labelEn }),
        ...(labelFr && { fr: labelFr }),
        ...(labelPt && { pt: labelPt }),
      },
    };

    try {
      if (isNew) {
        await api.createNavItem(body);
      } else if (id) {
        await api.updateNavItem(id, body);
      }
      navigate('/navigation');
    } catch (err: unknown) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  // ── Computed ───────────────────────────────────────────

  const menuInfo = MENU_INFO[menuSlug];
  const tipoInfo = TIPO_INFO[tipo];

  /** Friendly description of where the link points to */
  function getReferenciaPreview(): string {
    if (!referencia) return 'Sin destino';
    if (tipo === 'pagina') {
      const p = pages.find((x) => x.slug === referencia);
      return p ? `${p.title?.es || p.slug} (/${p.slug})` : referencia;
    }
    if (tipo === 'recurso') {
      const r = resources.find((x) => x.id === referencia || x.slug === referencia);
      return r ? `${r.name?.es || r.slug}` : referencia;
    }
    if (tipo === 'categoria') {
      const c = categories.find((x) => x.id === referencia || x.slug === referencia);
      return c ? `${c.name?.es || c.slug}` : referencia;
    }
    return referencia;
  }

  const filteredResources = resources.filter((r) => {
    if (!resourceSearch.trim()) return true;
    const q = resourceSearch.toLowerCase();
    return (r.name?.es || '').toLowerCase().includes(q) || r.slug.toLowerCase().includes(q);
  }).slice(0, 30);

  const rootCategories = categories.filter((c) => !c.parentId);

  // ── Render ─────────────────────────────────────────────

  if (loading) return <p>Cargando elemento...</p>;

  return (
    <Wizard
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onFinish={handleFinish}
      saving={saving}
      title={isNew ? 'Nuevo enlace de navegacion' : 'Editar enlace de navegacion'}
      subtitle={isNew
        ? 'Te guiamos paso a paso para anadir un enlace al menu del portal'
        : `Editando: ${labelEs || 'enlace'}`
      }
      finishLabel={isNew ? 'Crear enlace' : 'Guardar cambios'}
      onCancel={() => navigate('/navigation')}
    >
      {error && (
        <div className="alert alert-error" style={{ whiteSpace: 'pre-line', marginBottom: '1rem' }}>{error}</div>
      )}

      {/* ================================================================
          STEP 1 — Menu (donde colocar el enlace)
          ================================================================ */}
      {currentStep === 0 && (
        <WizardFieldGroup
          title="En que parte del portal aparecera este enlace?"
          description="Elige uno de los tres menus disponibles del portal publico."
          required
        >
          <div className="nav-wizard__option-grid">
            {MENUS.map((m) => {
              const info = MENU_INFO[m];
              return (
                <button
                  key={m}
                  type="button"
                  className={`nav-wizard__option ${menuSlug === m ? 'nav-wizard__option--active' : ''}`}
                  onClick={() => setMenuSlug(m)}
                >
                  <span className="nav-wizard__option-icon">{info.icon}</span>
                  <strong>{info.name}</strong>
                  <p>{info.desc}</p>
                </button>
              );
            })}
          </div>
        </WizardFieldGroup>
      )}

      {/* ================================================================
          STEP 2 — Tipo + Referencia (que enlazar)
          ================================================================ */}
      {currentStep === 1 && (
        <>
          <WizardFieldGroup
            title="Que tipo de enlace quieres anadir?"
            description="Cada tipo apunta a un sitio distinto del portal."
            required
          >
            <div className="nav-wizard__option-grid nav-wizard__option-grid--4">
              {TIPOS.map((t) => {
                const info = TIPO_INFO[t];
                return (
                  <button
                    key={t}
                    type="button"
                    className={`nav-wizard__option ${tipo === t ? 'nav-wizard__option--active' : ''}`}
                    onClick={() => { setTipo(t); setReferencia(''); }}
                  >
                    <span className="nav-wizard__option-icon">{info.icon}</span>
                    <strong>{info.name}</strong>
                    <p>{info.desc}</p>
                    <small className="nav-wizard__example">{info.example}</small>
                  </button>
                );
              })}
            </div>
          </WizardFieldGroup>

          {/* Type-specific destination selector */}
          <WizardFieldGroup
            title={`Selecciona el destino — ${tipoInfo.name}`}
            description="A donde debe llevar este enlace cuando el visitante haga click."
            required
          >
            {tipo === 'pagina' && (
              <div className="form-field">
                <select value={referencia} onChange={(e) => setReferencia(e.target.value)}>
                  <option value="">-- Elige una pagina --</option>
                  {pages.length === 0 && <option disabled>No hay paginas disponibles</option>}
                  {pages.map((p) => (
                    <option key={p.id} value={p.slug}>{p.title?.es || p.slug} ({p.status})</option>
                  ))}
                </select>
                <span className="field-hint">El enlace ira a /es/{referencia || '...'}</span>
              </div>
            )}

            {tipo === 'recurso' && (
              <>
                <div className="form-field">
                  <input
                    type="search"
                    placeholder="Buscar recurso por nombre o slug..."
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                  />
                </div>
                <div className="nav-wizard__resource-list">
                  {filteredResources.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`nav-wizard__resource ${referencia === r.slug ? 'nav-wizard__resource--active' : ''}`}
                      onClick={() => setReferencia(r.slug)}
                    >
                      <strong>{r.name?.es || r.slug}</strong>
                      <span>{r.slug}</span>
                    </button>
                  ))}
                  {filteredResources.length === 0 && (
                    <p style={{ color: 'var(--cms-text-light)', fontSize: '0.85rem' }}>Sin resultados</p>
                  )}
                </div>
              </>
            )}

            {tipo === 'categoria' && (
              <div className="form-field">
                <select value={referencia} onChange={(e) => setReferencia(e.target.value)}>
                  <option value="">-- Elige una categoria --</option>
                  {rootCategories.map((root) => (
                    <optgroup key={root.id} label={root.name?.es || root.slug}>
                      <option value={root.slug}>{root.name?.es || root.slug} (raiz)</option>
                      {categories.filter((c) => c.parentId === root.id).map((sub) => (
                        <option key={sub.id} value={sub.slug}>↳ {sub.name?.es || sub.slug}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {tipo === 'url_externa' && (
              <div className="form-field">
                <input
                  type="url"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="https://turismo.gal"
                  autoFocus
                />
                <span className="field-hint">URL completa con http:// o https://</span>
              </div>
            )}
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 3 — Etiquetas multilingues
          ================================================================ */}
      {currentStep === 2 && (
        <>
          <WizardFieldGroup
            title="Etiqueta principal (castellano)"
            description="El texto que el visitante vera en el menu. Mantenlo corto y claro."
            required
            tip="Las mejores etiquetas tienen 1-3 palabras: 'Inicio', 'Que ver', 'Contacto'. Evita frases largas."
          >
            <div className="form-field">
              <input
                value={labelEs}
                onChange={(e) => setLabelEs(e.target.value)}
                placeholder="Ej: Inicio, Que ver, Contacto..."
                autoFocus
                maxLength={30}
              />
              <span className={`field-hint ${labelEs.length > 25 ? 'field-hint--warn' : ''}`}>
                {labelEs.length}/30 caracteres
              </span>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Traducciones a otros idiomas"
            description="La IA puede traducir automaticamente la etiqueta a los 4 idiomas restantes."
          >
            <div className="form-row">
              <div className="form-field">
                <label>
                  Gallego
                  <button type="button" className="translate-btn" disabled={!labelEs || !!translating} onClick={() => handleTranslate(labelEs, 'gl', setLabelGl)}>
                    {translating === 'gl' ? '...' : 'Traducir'}
                  </button>
                </label>
                <input value={labelGl} onChange={(e) => setLabelGl(e.target.value)} placeholder="Ex: Inicio" maxLength={30} />
              </div>
              <div className="form-field">
                <label>
                  Ingles
                  <button type="button" className="translate-btn" disabled={!labelEs || !!translating} onClick={() => handleTranslate(labelEs, 'en', setLabelEn)}>
                    {translating === 'en' ? '...' : 'Traducir'}
                  </button>
                </label>
                <input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="Ej: Home" maxLength={30} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>
                  Frances
                  <button type="button" className="translate-btn" disabled={!labelEs || !!translating} onClick={() => handleTranslate(labelEs, 'fr', setLabelFr)}>
                    {translating === 'fr' ? '...' : 'Traducir'}
                  </button>
                </label>
                <input value={labelFr} onChange={(e) => setLabelFr(e.target.value)} placeholder="Ej: Accueil" maxLength={30} />
              </div>
              <div className="form-field">
                <label>
                  Portugues
                  <button type="button" className="translate-btn" disabled={!labelEs || !!translating} onClick={() => handleTranslate(labelEs, 'pt', setLabelPt)}>
                    {translating === 'pt' ? '...' : 'Traducir'}
                  </button>
                </label>
                <input value={labelPt} onChange={(e) => setLabelPt(e.target.value)} placeholder="Ej: Inicio" maxLength={30} />
              </div>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 4 — Opciones (orden, visibilidad, parent)
          ================================================================ */}
      {currentStep === 3 && (
        <>
          <WizardFieldGroup
            title="Posicion en el menu"
            description="Donde aparece el enlace dentro del menu (0 es el primero)."
            tip="Puedes editar el orden mas tarde. Los items se muestran de menor a mayor numero."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Orden</label>
                <input type="number" min="0" value={orden} onChange={(e) => setOrden(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="checkbox-label" style={{ marginTop: '1.5rem' }}>
                  <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                  Visible en el menu
                </label>
                <span className="field-hint">Desmarcar para ocultar temporalmente sin eliminar</span>
              </div>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Submenu (opcional)"
            description="Si este enlace forma parte de un submenu, elige el item padre. Si es de primer nivel, dejalo en blanco."
          >
            <div className="form-field">
              <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">-- Sin padre (primer nivel) --</option>
                {siblingItems
                  .filter((it) => !it.parentId && it.id !== id)
                  .map((it) => (
                    <option key={it.id} value={it.id}>{it.label?.es || '(sin etiqueta)'}</option>
                  ))}
              </select>
              <span className="field-hint">
                Solo muestra items del menu actual ({menuInfo.name}) que no son ya submenu de otro
              </span>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 5 — Revision
          ================================================================ */}
      {currentStep === 4 && (
        <div className="wizard__completion-grid">
          <WizardCompletionCard
            title="Ubicacion"
            icon="📍"
            onEdit={() => setCurrentStep(0)}
            items={[
              { label: 'Menu', value: `${menuInfo.icon} ${menuInfo.name}`, status: 'complete' },
            ]}
          />

          <WizardCompletionCard
            title="Destino"
            icon="🔗"
            onEdit={() => setCurrentStep(1)}
            items={[
              { label: 'Tipo', value: `${tipoInfo.icon} ${tipoInfo.name}`, status: 'complete' },
              { label: 'Apunta a', value: getReferenciaPreview(), status: referencia ? 'complete' : 'incomplete' },
            ]}
          />

          <WizardCompletionCard
            title="Etiquetas"
            icon="🏷️"
            onEdit={() => setCurrentStep(2)}
            items={[
              { label: 'Castellano', value: labelEs, status: labelEs ? 'complete' : 'incomplete' },
              { label: 'Gallego', value: labelGl, status: labelGl ? 'complete' : 'warning' },
              { label: 'Ingles', value: labelEn, status: labelEn ? 'complete' : 'warning' },
              { label: 'Frances', value: labelFr, status: labelFr ? 'complete' : 'warning' },
              { label: 'Portugues', value: labelPt, status: labelPt ? 'complete' : 'warning' },
            ]}
          />

          <WizardCompletionCard
            title="Opciones"
            icon="⚙️"
            onEdit={() => setCurrentStep(3)}
            items={[
              { label: 'Orden', value: orden, status: 'complete' },
              { label: 'Visible', value: visible ? 'Si' : 'No', status: 'complete' },
              {
                label: 'Submenu de',
                value: parentId
                  ? siblingItems.find((it) => it.id === parentId)?.label?.es || '—'
                  : 'Primer nivel',
                status: 'complete',
              },
            ]}
          />
        </div>
      )}
    </Wizard>
  );
}
