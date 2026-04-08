import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type ProductItem } from '@/lib/api';
import { Wizard, WizardFieldGroup, WizardCompletionCard, type WizardStepDef } from '@/components/Wizard';
import { RichTextEditor } from '@/components/RichTextEditor';
import { AiWritingAssistant } from '@/components/AiWritingAssistant';
import { aiTranslate } from '@/lib/ai';

/**
 * ProductWizardPage — Asistente "guia burros" para productos turisticos
 *
 * Productos turisticos son agrupaciones tematicas de recursos
 * (Ruta del Vino, Ruta del Marisco, etc.). Wizard de 3 pasos
 * porque la entidad tiene pocos campos.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function ProductWizardPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);

  // Form state
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [descEs, setDescEs] = useState('');
  const [descGl, setDescGl] = useState('');
  const [activo, setActivo] = useState(true);

  // Load existing product
  useEffect(() => {
    if (isNew || !id) return;
    api.getProducts()
      .then((products: ProductItem[]) => {
        const found = products.find((p) => p.id === id);
        if (!found) {
          setError('Producto no encontrado');
          setLoading(false);
          return;
        }
        setSlug(found.slug);
        setNameEs(found.name?.es || '');
        setNameGl(found.name?.gl || '');
        setNameEn(found.name?.en || '');
        setNameFr(found.name?.fr || '');
        setNamePt(found.name?.pt || '');
        setDescEs(found.description?.es || '');
        setDescGl(found.description?.gl || '');
        setActivo(found.activo);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id, isNew]);

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

  // ── Validation ───────────────────────────────────────

  const validateStep1 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!nameEs.trim()) errs.push('El nombre en castellano es obligatorio');
    if (!slug.trim()) errs.push('El slug es obligatorio');
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errs.push('El slug solo admite letras minusculas, numeros y guiones');
    return errs;
  }, [nameEs, slug]);

  // ── Step definitions ─────────────────────────────────

  const steps: WizardStepDef[] = [
    {
      id: 'identificacion',
      title: 'Identificacion',
      subtitle: 'Nombre, slug y estado',
      icon: '🎯',
      help: 'Define el nombre principal del producto turistico. Los productos son agrupaciones tematicas de recursos: rutas, experiencias, paquetes...',
      validate: validateStep1,
    },
    {
      id: 'contenido',
      title: 'Contenido',
      subtitle: 'Descripcion y traducciones',
      icon: '✏️',
      help: 'Describe el producto turistico. Como una "Ruta do Viño" o "Experiencia de marisqueo". La IA puede ayudarte a redactar y traducir.',
      optional: true,
    },
    {
      id: 'revision',
      title: 'Revision',
      subtitle: 'Confirmar y guardar',
      icon: '✅',
      help: 'Revisa todos los datos antes de guardar.',
    },
  ];

  // ── Save / Submit ────────────────────────────────────

  async function handleFinish() {
    setError(null);
    setSaving(true);

    const body = {
      slug,
      activo,
      name: {
        es: nameEs,
        gl: nameGl,
        ...(nameEn && { en: nameEn }),
        ...(nameFr && { fr: nameFr }),
        ...(namePt && { pt: namePt }),
      },
      description: { es: descEs, gl: descGl },
    };

    try {
      if (isNew) {
        await api.createProduct(body);
      } else if (id) {
        await api.updateProduct(id, body);
      }
      navigate('/products');
    } catch (err: unknown) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────

  if (loading) return <p>Cargando producto...</p>;

  return (
    <Wizard
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onFinish={handleFinish}
      saving={saving}
      title={isNew ? 'Nuevo producto turistico' : 'Editar producto'}
      subtitle={isNew
        ? 'Te guiamos paso a paso para crear un producto turistico (ruta, experiencia, paquete...)'
        : `Editando: ${nameEs || slug}`
      }
      finishLabel={isNew ? 'Crear producto' : 'Guardar cambios'}
      onCancel={() => navigate('/products')}
    >
      {error && (
        <div className="alert alert-error" style={{ whiteSpace: 'pre-line', marginBottom: '1rem' }}>{error}</div>
      )}

      {/* ================================================================
          STEP 1 — Identificacion
          ================================================================ */}
      {currentStep === 0 && (
        <>
          <WizardFieldGroup
            title="Nombre del producto"
            description="El nombre principal tal como aparecera en el portal."
            required
            tip="Los nombres mas efectivos son cortos y evocadores: 'Ruta do Viño', 'Camiño dos Faros', 'Experiencia Marisqueira'."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Nombre (ES) *</label>
                <input
                  value={nameEs}
                  onChange={(e) => handleNameEsChange(e.target.value)}
                  placeholder="Ej: Ruta do Vino"
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label>
                  Nombre (GL)
                  <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'gl', setNameGl)}>
                    {translating === 'gl' ? '...' : 'Traducir a GL'}
                  </button>
                </label>
                <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Ej: Ruta do Viño" />
              </div>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Slug y estado"
            description="El slug es la URL amigable. Se genera automaticamente."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Slug *</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ruta-do-vino"
                  disabled={!isNew}
                />
                {!isNew && <span className="field-hint">El slug no se puede cambiar</span>}
              </div>
              <div className="form-field">
                <label className="checkbox-label" style={{ marginTop: '1.5rem' }}>
                  <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                  Producto activo
                </label>
                <span className="field-hint">Desactivar para ocultar temporalmente sin eliminar</span>
              </div>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 2 — Contenido (descripciones + traducciones)
          ================================================================ */}
      {currentStep === 1 && (
        <>
          <WizardFieldGroup
            title="Descripcion en castellano"
            description="Describe que es este producto turistico, que incluye y a quien va dirigido."
            tip="Una buena descripcion explica las experiencias o recursos que agrupa el producto y los publicos objetivo (familias, parejas, gastronomos...)."
          >
            <RichTextEditor
              value={descEs}
              onChange={(html) => setDescEs(html)}
              placeholder="Describe el producto turistico..."
              minHeight={200}
            />
            <AiWritingAssistant
              text={descEs}
              lang="es"
              onAccept={(t) => setDescEs(t)}
              translationTargets={[
                { lang: 'gl', label: 'Gallego', onAccept: (t) => setDescGl(t) },
              ]}
            />
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Descripcion en gallego"
            description="Traduccion al gallego de la descripcion principal."
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
              <button
                type="button"
                className="translate-btn"
                disabled={!descEs || !!translating}
                onClick={() => handleTranslate(descEs, 'gl', setDescGl)}
              >
                {translating === 'gl-desc' ? 'Traduciendo...' : 'Traducir automaticamente a GL'}
              </button>
            </div>
            <RichTextEditor
              value={descGl}
              onChange={(html) => setDescGl(html)}
              placeholder="Descricion en galego..."
              minHeight={200}
            />
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Traducciones del nombre"
            description="Nombre del producto en otros idiomas (opcional pero recomendado)."
          >
            <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-field">
                <label>
                  Nombre (EN)
                  <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'en', setNameEn)}>
                    {translating === 'en' ? '...' : 'Traducir'}
                  </button>
                </label>
                <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Ej: Wine Route" />
              </div>
              <div className="form-field">
                <label>
                  Nombre (FR)
                  <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'fr', setNameFr)}>
                    {translating === 'fr' ? '...' : 'Traducir'}
                  </button>
                </label>
                <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder="Ej: Route du Vin" />
              </div>
              <div className="form-field">
                <label>
                  Nombre (PT)
                  <button type="button" className="translate-btn" disabled={!nameEs || !!translating} onClick={() => handleTranslate(nameEs, 'pt', setNamePt)}>
                    {translating === 'pt' ? '...' : 'Traducir'}
                  </button>
                </label>
                <input value={namePt} onChange={(e) => setNamePt(e.target.value)} placeholder="Ej: Rota do Vinho" />
              </div>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* ================================================================
          STEP 3 — Revision
          ================================================================ */}
      {currentStep === 2 && (
        <div className="wizard__completion-grid">
          <WizardCompletionCard
            title="Identificacion"
            icon="🎯"
            onEdit={() => setCurrentStep(0)}
            items={[
              { label: 'Nombre (ES)', value: nameEs, status: nameEs ? 'complete' : 'incomplete' },
              { label: 'Slug', value: slug, status: slug ? 'complete' : 'incomplete' },
              { label: 'Activo', value: activo ? 'Si' : 'No', status: 'complete' },
            ]}
          />

          <WizardCompletionCard
            title="Contenido"
            icon="✏️"
            onEdit={() => setCurrentStep(1)}
            items={[
              { label: 'Descripcion ES', value: descEs ? `${descEs.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length} palabras` : '', status: descEs ? 'complete' : 'warning' },
              { label: 'Descripcion GL', value: descGl ? `${descGl.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length} palabras` : '', status: descGl ? 'complete' : 'warning' },
            ]}
          />

          <WizardCompletionCard
            title="Idiomas"
            icon="🌐"
            onEdit={() => setCurrentStep(1)}
            items={[
              { label: 'Gallego', value: nameGl, status: nameGl ? 'complete' : 'warning' },
              { label: 'Ingles', value: nameEn, status: nameEn ? 'complete' : 'warning' },
              { label: 'Frances', value: nameFr, status: nameFr ? 'complete' : 'warning' },
              { label: 'Portugues', value: namePt, status: namePt ? 'complete' : 'warning' },
            ]}
          />
        </div>
      )}
    </Wizard>
  );
}
