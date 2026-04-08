import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type CategoryItem } from '@/lib/api';
import { Wizard, WizardFieldGroup, WizardCompletionCard, type WizardStepDef } from '@/components/Wizard';
import { aiTranslate } from '@/lib/ai';

/**
 * CategoryWizardPage — Asistente "guia burros" para categorias
 *
 * Resuelve la confusion del formulario plano:
 * - Diferenciar visualmente raiz vs subcategoria
 * - Auto-slug a partir del nombre
 * - Traducciones a 5 idiomas con IA
 * - Vista previa del arbol resultante en la revision
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function CategoryWizardPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  // UI state
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);

  // Reference data
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);

  // Form state
  const [parentId, setParentId] = useState<string>('');
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [orden, setOrden] = useState('0');
  const [activo, setActivo] = useState(true);
  // Whether the user picked "raiz" or "subcategoria"
  const [categoryKind, setCategoryKind] = useState<'raiz' | 'sub' | null>(null);

  // ── Data loading ────────────────────────────────────────

  useEffect(() => {
    api.getAdminCategories().then(setAllCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew || !id) return;
    api.getAdminCategories().then((cats) => {
      const found = cats.find((c) => c.id === id);
      if (!found) {
        setError('Categoria no encontrada');
        setLoading(false);
        return;
      }
      setSlug(found.slug);
      setNameEs(found.name?.es || '');
      setNameGl(found.name?.gl || '');
      setNameEn(found.name?.en || '');
      setNameFr(found.name?.fr || '');
      setNamePt(found.name?.pt || '');
      setParentId(found.parentId || '');
      setOrden(String(found.orden));
      setActivo(found.activo);
      setCategoryKind(found.parentId ? 'sub' : 'raiz');
      setLoading(false);
    }).catch((err) => { setError(err.message); setLoading(false); });
  }, [id, isNew]);

  // ── Helpers ──────────────────────────────────────────────

  function handleNameEsChange(value: string) {
    setNameEs(value);
    if (isNew) setSlug(slugify(value));
  }

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

  async function handleTranslateAll() {
    if (!nameEs.trim()) return;
    setTranslating('all');
    try {
      const [gl, en, fr, pt] = await Promise.all([
        nameGl ? Promise.resolve(nameGl) : aiTranslate(nameEs, 'es', 'gl'),
        nameEn ? Promise.resolve(nameEn) : aiTranslate(nameEs, 'es', 'en'),
        nameFr ? Promise.resolve(nameFr) : aiTranslate(nameEs, 'es', 'fr'),
        namePt ? Promise.resolve(namePt) : aiTranslate(nameEs, 'es', 'pt'),
      ]);
      if (!nameGl) setNameGl(gl);
      if (!nameEn) setNameEn(en);
      if (!nameFr) setNameFr(fr);
      if (!namePt) setNamePt(pt);
    } catch {
      // silent
    } finally {
      setTranslating(null);
    }
  }

  // ── Validation ────────────────────────────────────────

  const validateStep1 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!categoryKind) errs.push('Elige si es raiz o subcategoria');
    if (categoryKind === 'sub' && !parentId) errs.push('Selecciona la categoria padre');
    return errs;
  }, [categoryKind, parentId]);

  const validateStep2 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!nameEs.trim()) errs.push('El nombre en castellano es obligatorio');
    if (!slug.trim()) errs.push('El slug es obligatorio');
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errs.push('El slug solo admite letras minusculas, numeros y guiones');
    // Detect duplicate slug at the same level
    const siblings = allCategories.filter((c) => (c.parentId || '') === (parentId || ''));
    if (siblings.some((c) => c.slug === slug && c.id !== id)) {
      errs.push(`Ya existe una categoria con slug "${slug}" en este nivel`);
    }
    return errs;
  }, [nameEs, slug, parentId, allCategories, id]);

  // ── Step definitions ───────────────────────────────────

  const steps: WizardStepDef[] = [
    {
      id: 'tipo',
      title: 'Tipo',
      subtitle: 'Raiz o subcategoria',
      icon: '🌳',
      help: 'Decide si esta categoria es de primer nivel (raiz) o pertenece a una categoria padre. Las raices son grupos amplios (Alojamientos, Restauracion). Las subcategorias son especializaciones (Hoteles, Casas rurales).',
      validate: validateStep1,
    },
    {
      id: 'nombre',
      title: 'Nombre',
      subtitle: 'Nombre principal y URL',
      icon: '🏷️',
      help: 'Dale un nombre claro en castellano. El slug (la URL amigable) se genera automaticamente.',
      validate: validateStep2,
    },
    {
      id: 'traducciones',
      title: 'Idiomas',
      subtitle: 'Traducciones a otros idiomas',
      icon: '🌐',
      help: 'Traduce el nombre a los demas idiomas. Puedes hacerlo todo a la vez con el boton "Traducir todo con IA".',
      optional: true,
    },
    {
      id: 'opciones',
      title: 'Opciones',
      subtitle: 'Orden y visibilidad',
      icon: '⚙️',
      help: 'Configura el orden de aparicion y si la categoria esta activa.',
      optional: true,
    },
    {
      id: 'revision',
      title: 'Revision',
      subtitle: 'Confirmar y guardar',
      icon: '✅',
      help: 'Revisa los datos y la posicion de la categoria en el arbol antes de guardar.',
    },
  ];

  // ── Save / Submit ──────────────────────────────────────

  async function handleFinish() {
    setError(null);
    setSaving(true);

    const body = {
      slug,
      parent_id: categoryKind === 'sub' ? parentId : null,
      orden: parseInt(orden, 10) || 0,
      activo,
      name: {
        es: nameEs,
        gl: nameGl,
        ...(nameEn && { en: nameEn }),
        ...(nameFr && { fr: nameFr }),
        ...(namePt && { pt: namePt }),
      },
    };

    try {
      if (isNew) {
        await api.createCategory(body);
      } else if (id) {
        await api.updateCategory(id, body);
      }
      navigate('/categories');
    } catch (err: unknown) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  // ── Computed ───────────────────────────────────────────

  const rootCategories = allCategories.filter((c) => !c.parentId).sort((a, b) => a.orden - b.orden);
  const parentCategory = parentId ? allCategories.find((c) => c.id === parentId) : null;
  const subCategoriesOfParent = parentId
    ? allCategories.filter((c) => c.parentId === parentId).sort((a, b) => a.orden - b.orden)
    : [];

  // ── Render ─────────────────────────────────────────────

  if (loading) return <p>Cargando categoria...</p>;

  return (
    <Wizard
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onFinish={handleFinish}
      saving={saving}
      title={isNew ? 'Nueva categoria' : 'Editar categoria'}
      subtitle={isNew
        ? 'Te guiamos paso a paso para anadir una nueva categoria al arbol'
        : `Editando: ${nameEs || slug}`
      }
      finishLabel={isNew ? 'Crear categoria' : 'Guardar cambios'}
      onCancel={() => navigate('/categories')}
    >
      {error && (
        <div className="alert alert-error" style={{ whiteSpace: 'pre-line', marginBottom: '1rem' }}>{error}</div>
      )}

      {/* ================================================================
          STEP 1 — Tipo de categoria
          ================================================================ */}
      {currentStep === 0 && (
        <>
          <WizardFieldGroup
            title="Categoria raiz o subcategoria?"
            description="Las categorias raiz aparecen como grupos principales. Las subcategorias se anidan dentro de una raiz."
            required
          >
            <div className="cat-wizard__kind-grid">
              <button
                type="button"
                className={`cat-wizard__kind ${categoryKind === 'raiz' ? 'cat-wizard__kind--active' : ''}`}
                onClick={() => { setCategoryKind('raiz'); setParentId(''); }}
              >
                <span className="cat-wizard__kind-icon">🌳</span>
                <strong>Categoria raiz</strong>
                <p>Grupo principal de primer nivel (ej: Alojamientos, Restauracion, Naturaleza)</p>
                <small>Sin categoria padre</small>
              </button>

              <button
                type="button"
                className={`cat-wizard__kind ${categoryKind === 'sub' ? 'cat-wizard__kind--active' : ''}`}
                onClick={() => setCategoryKind('sub')}
              >
                <span className="cat-wizard__kind-icon">🌿</span>
                <strong>Subcategoria</strong>
                <p>Especializacion dentro de una categoria raiz (ej: Hoteles dentro de Alojamientos)</p>
                <small>Pertenece a una categoria padre</small>
              </button>
            </div>
          </WizardFieldGroup>

          {categoryKind === 'sub' && (
            <WizardFieldGroup
              title="Categoria padre"
              description="Selecciona la categoria raiz a la que pertenecera esta nueva subcategoria."
              required
            >
              <div className="form-field">
                <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">-- Elige una categoria padre --</option>
                  {rootCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name?.es || c.slug} ({c.resourceCount || 0} recursos)
                    </option>
                  ))}
                </select>
                {rootCategories.length === 0 && (
                  <span className="field-hint">No hay categorias raiz todavia. Crea primero una raiz.</span>
                )}
              </div>
            </WizardFieldGroup>
          )}
        </>
      )}

      {/* ================================================================
          STEP 2 — Nombre y slug
          ================================================================ */}
      {currentStep === 1 && (
        <>
          <WizardFieldGroup
            title="Nombre de la categoria (castellano)"
            description="El nombre principal tal como aparecera en el portal y en el CMS."
            required
            tip="Mejor en plural y singular: 'Playas', 'Hoteles', 'Restaurantes'. No uses articulos."
          >
            <div className="form-field">
              <input
                value={nameEs}
                onChange={(e) => handleNameEsChange(e.target.value)}
                placeholder="Ej: Playas"
                autoFocus
                maxLength={50}
              />
              <span className="field-hint">{nameEs.length}/50 caracteres</span>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Slug (URL amigable)"
            description="Identificador de la categoria en URLs. Se genera automaticamente."
          >
            <div className="form-field">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="playas"
                disabled={!isNew}
              />
              {!isNew && <span className="field-hint">El slug no se puede cambiar para proteger las URLs existentes</span>}
              {isNew && slug && (
                <span className="field-hint">
                  Vista previa: /buscar?categoria=<strong>{slug}</strong>
                </span>
              )}
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 3 — Traducciones
          ================================================================ */}
      {currentStep === 2 && (
        <WizardFieldGroup
          title="Traducciones a otros idiomas"
          description="El nombre de la categoria en cada idioma. Pulsa el boton para traducir todo de una vez con IA."
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button
              type="button"
              className="ai-writer__btn"
              onClick={handleTranslateAll}
              disabled={!nameEs || !!translating}
            >
              {translating === 'all' ? 'Traduciendo...' : '✨ Traducir todo con IA'}
            </button>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>
                Gallego
                <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'gl', setNameGl)}>
                  {translating === 'gl' ? '...' : 'Traducir'}
                </button>
              </label>
              <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Ex: Praias" maxLength={50} />
            </div>
            <div className="form-field">
              <label>
                Ingles
                <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'en', setNameEn)}>
                  {translating === 'en' ? '...' : 'Traducir'}
                </button>
              </label>
              <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Ej: Beaches" maxLength={50} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>
                Frances
                <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'fr', setNameFr)}>
                  {translating === 'fr' ? '...' : 'Traducir'}
                </button>
              </label>
              <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder="Ej: Plages" maxLength={50} />
            </div>
            <div className="form-field">
              <label>
                Portugues
                <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'pt', setNamePt)}>
                  {translating === 'pt' ? '...' : 'Traducir'}
                </button>
              </label>
              <input value={namePt} onChange={(e) => setNamePt(e.target.value)} placeholder="Ej: Praias" maxLength={50} />
            </div>
          </div>
        </WizardFieldGroup>
      )}

      {/* ================================================================
          STEP 4 — Opciones
          ================================================================ */}
      {currentStep === 3 && (
        <WizardFieldGroup
          title="Orden y visibilidad"
          description="Posicion de la categoria entre sus hermanas y si esta activa."
          tip="Las categorias se ordenan de menor a mayor numero. Para que aparezca primera, usa orden 0."
        >
          <div className="form-row">
            <div className="form-field">
              <label>Orden</label>
              <input type="number" min="0" value={orden} onChange={(e) => setOrden(e.target.value)} />
              <span className="field-hint">0 = primera, 10 = ultima del grupo</span>
            </div>
            <div className="form-field">
              <label className="checkbox-label" style={{ marginTop: '1.5rem' }}>
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                Categoria activa
              </label>
              <span className="field-hint">Desactivar para ocultar temporalmente sin eliminar</span>
            </div>
          </div>
        </WizardFieldGroup>
      )}

      {/* ================================================================
          STEP 5 — Revision con preview del arbol
          ================================================================ */}
      {currentStep === 4 && (
        <>
          <div className="wizard__completion-grid">
            <WizardCompletionCard
              title="Tipo"
              icon="🌳"
              onEdit={() => setCurrentStep(0)}
              items={[
                { label: 'Tipo', value: categoryKind === 'raiz' ? 'Categoria raiz' : 'Subcategoria', status: 'complete' },
                ...(categoryKind === 'sub'
                  ? [{ label: 'Padre', value: parentCategory?.name?.es || parentCategory?.slug || '—', status: 'complete' as const }]
                  : []),
              ]}
            />

            <WizardCompletionCard
              title="Nombre"
              icon="🏷️"
              onEdit={() => setCurrentStep(1)}
              items={[
                { label: 'Castellano', value: nameEs, status: nameEs ? 'complete' : 'incomplete' },
                { label: 'Slug', value: slug, status: slug ? 'complete' : 'incomplete' },
              ]}
            />

            <WizardCompletionCard
              title="Idiomas"
              icon="🌐"
              onEdit={() => setCurrentStep(2)}
              items={[
                { label: 'Gallego', value: nameGl, status: nameGl ? 'complete' : 'warning' },
                { label: 'Ingles', value: nameEn, status: nameEn ? 'complete' : 'warning' },
                { label: 'Frances', value: nameFr, status: nameFr ? 'complete' : 'warning' },
                { label: 'Portugues', value: namePt, status: namePt ? 'complete' : 'warning' },
              ]}
            />

            <WizardCompletionCard
              title="Opciones"
              icon="⚙️"
              onEdit={() => setCurrentStep(3)}
              items={[
                { label: 'Orden', value: orden, status: 'complete' },
                { label: 'Activa', value: activo ? 'Si' : 'No', status: 'complete' },
              ]}
            />
          </div>

          {/* Tree preview */}
          <div className="cat-wizard__tree-preview">
            <h3 className="cat-wizard__tree-title">Asi quedara el arbol</h3>
            <div className="cat-wizard__tree">
              {categoryKind === 'raiz' ? (
                <>
                  {/* New root highlighted, plus existing roots */}
                  <div className="cat-wizard__tree-node cat-wizard__tree-node--new">
                    🌳 <strong>{nameEs || '(nueva categoria)'}</strong>
                    <span className="cat-wizard__tree-badge">NUEVA</span>
                  </div>
                  {rootCategories.filter((c) => c.id !== id).slice(0, 5).map((c) => (
                    <div key={c.id} className="cat-wizard__tree-node">
                      🌳 {c.name?.es || c.slug}
                    </div>
                  ))}
                  {rootCategories.length > 5 && (
                    <div className="cat-wizard__tree-node cat-wizard__tree-node--muted">
                      ... y {rootCategories.length - 5} mas
                    </div>
                  )}
                </>
              ) : parentCategory ? (
                <>
                  <div className="cat-wizard__tree-node">
                    🌳 <strong>{parentCategory.name?.es || parentCategory.slug}</strong>
                  </div>
                  <div className="cat-wizard__tree-node cat-wizard__tree-node--child cat-wizard__tree-node--new">
                    🌿 <strong>{nameEs || '(nueva subcategoria)'}</strong>
                    <span className="cat-wizard__tree-badge">NUEVA</span>
                  </div>
                  {subCategoriesOfParent.filter((c) => c.id !== id).map((c) => (
                    <div key={c.id} className="cat-wizard__tree-node cat-wizard__tree-node--child">
                      🌿 {c.name?.es || c.slug}
                    </div>
                  ))}
                </>
              ) : (
                <p style={{ color: 'var(--cms-text-light)', fontSize: '0.85rem' }}>
                  Selecciona una categoria padre en el paso 1 para ver el arbol
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </Wizard>
  );
}
