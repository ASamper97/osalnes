import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type PageItem } from '@/lib/api';
import { Wizard, WizardFieldGroup, WizardCompletionCard, type WizardStepDef } from '@/components/Wizard';
import { AiWritingAssistant } from '@/components/AiWritingAssistant';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const WEB_BASE = import.meta.env.VITE_WEB_URL || 'http://localhost:3000';

const TEMPLATES = [
  { value: 'default', label: 'Estandar', desc: 'Pagina con titulo, texto y sidebar lateral' },
  { value: 'landing', label: 'Landing', desc: 'Pagina completa sin sidebar, ideal para promociones' },
  { value: 'info', label: 'Informativa', desc: 'Pagina con estructura de preguntas y respuestas' },
  { value: 'experiencia', label: 'Experiencia', desc: 'Pagina tipo storytelling con imagenes a pantalla completa' },
];

async function translateText(text: string, from: string, to: string): Promise<string> {
  if (!text.trim()) return '';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auto-translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ texto: text, from, to }),
  });
  if (!res.ok) throw new Error('Translation failed');
  const data = await res.json();
  return data.translated || data.texto_traducido || text;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function PageWizardPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);

  // Form state
  const [slug, setSlug] = useState('');
  const [template, setTemplate] = useState('default');
  const [titleEs, setTitleEs] = useState('');
  const [titleGl, setTitleGl] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [titlePt, setTitlePt] = useState('');
  const [bodyEs, setBodyEs] = useState('');
  const [bodyGl, setBodyGl] = useState('');
  const [seoTitleEs, setSeoTitleEs] = useState('');
  const [seoTitleGl, setSeoTitleGl] = useState('');
  const [seoDescEs, setSeoDescEs] = useState('');
  const [seoDescGl, setSeoDescGl] = useState('');

  // Load existing page
  useEffect(() => {
    if (!id) return;
    api.getAdminPage(id)
      .then((p) => {
        setSlug(p.slug);
        setTemplate(p.template || 'default');
        setTitleEs(p.title?.es || '');
        setTitleGl(p.title?.gl || '');
        setTitleEn(p.title?.en || '');
        setTitleFr(p.title?.fr || '');
        setTitlePt(p.title?.pt || '');
        setBodyEs(p.body?.es || '');
        setBodyGl(p.body?.gl || '');
        setSeoTitleEs(p.seoTitle?.es || '');
        setSeoTitleGl(p.seoTitle?.gl || '');
        setSeoDescEs(p.seoDescription?.es || '');
        setSeoDescGl(p.seoDescription?.gl || '');
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id]);

  async function handleTranslate(sourceText: string, targetLang: string, setter: (v: string) => void) {
    if (!sourceText.trim()) return;
    setTranslating(`${targetLang}-${Date.now()}`);
    try {
      setter(await translateText(sourceText, 'es', targetLang));
    } catch {
      // silent
    } finally {
      setTranslating(null);
    }
  }

  function handleTitleEsChange(value: string) {
    setTitleEs(value);
    if (isNew) setSlug(slugify(value));
  }

  // Validation
  const validateStep1 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!titleEs.trim()) errs.push('El titulo en castellano es obligatorio');
    if (!slug.trim()) errs.push('El slug es obligatorio');
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errs.push('El slug solo admite letras minusculas, numeros y guiones');
    return errs;
  }, [titleEs, slug]);

  const validateStep3 = useCallback((): string[] => {
    const errs: string[] = [];
    if (seoDescEs.length > 300) errs.push('Descripcion SEO (ES) demasiado larga (max 300)');
    if (seoDescGl.length > 300) errs.push('Descripcion SEO (GL) demasiado larga (max 300)');
    return errs;
  }, [seoDescEs, seoDescGl]);

  const steps: WizardStepDef[] = [
    {
      id: 'basico',
      title: 'Basico',
      subtitle: 'Titulo, slug y plantilla',
      icon: '📄',
      help: 'Dale un titulo a la pagina, elige la plantilla que mejor se ajuste y asegurate de que el slug es descriptivo.',
      validate: validateStep1,
    },
    {
      id: 'contenido',
      title: 'Contenido',
      subtitle: 'Texto de la pagina',
      icon: '✏️',
      help: 'Escribe el contenido principal de la pagina en castellano y gallego. El contenido puede incluir HTML basico.',
    },
    {
      id: 'seo-idiomas',
      title: 'SEO e idiomas',
      subtitle: 'Buscadores y traducciones',
      icon: '🌐',
      help: 'Optimiza la pagina para buscadores y anade traducciones del titulo a otros idiomas.',
      validate: validateStep3,
      optional: true,
    },
    {
      id: 'revision',
      title: 'Revision',
      subtitle: 'Confirmar y guardar',
      icon: '✅',
      help: 'Revisa todos los datos antes de guardar la pagina.',
    },
  ];

  async function handleFinish() {
    setError(null);
    setSaving(true);

    const body = {
      slug,
      template,
      title: { es: titleEs, gl: titleGl, ...(titleEn && { en: titleEn }), ...(titleFr && { fr: titleFr }), ...(titlePt && { pt: titlePt }) },
      body: { es: bodyEs, gl: bodyGl },
      seo_title: { es: seoTitleEs, gl: seoTitleGl },
      seo_description: { es: seoDescEs, gl: seoDescGl },
    };

    try {
      if (isNew) {
        await api.createPage(body);
      } else {
        await api.updatePage(id!, body);
      }
      navigate('/pages');
    } catch (err: unknown) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando pagina...</p>;

  const selectedTemplate = TEMPLATES.find((t) => t.value === template);

  return (
    <Wizard
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onFinish={handleFinish}
      saving={saving}
      title={isNew ? 'Nueva pagina editorial' : 'Editar pagina'}
      subtitle={isNew
        ? 'Crea una nueva pagina de contenido para el portal'
        : `Editando: ${titleEs || slug}`
      }
      finishLabel={isNew ? 'Crear pagina' : 'Guardar cambios'}
      onCancel={() => navigate('/pages')}
    >
      {error && (
        <div className="alert alert-error" style={{ whiteSpace: 'pre-line', marginBottom: '1rem' }}>{error}</div>
      )}

      {/* STEP 1 — Basico */}
      {currentStep === 0 && (
        <>
          <WizardFieldGroup
            title="Titulo de la pagina"
            description="El titulo principal que veran los visitantes."
            required
          >
            <div className="form-row">
              <div className="form-field">
                <label>Titulo (ES) *</label>
                <input value={titleEs} onChange={(e) => handleTitleEsChange(e.target.value)} placeholder="Ej: Informacion practica para visitantes" autoFocus />
              </div>
              <div className="form-field">
                <label>
                  Titulo (GL)
                  <button type="button" className="translate-btn" disabled={!titleEs || !!translating} onClick={() => handleTranslate(titleEs, 'gl', setTitleGl)}>
                    {translating ? '...' : 'Traducir a GL'}
                  </button>
                </label>
                <input value={titleGl} onChange={(e) => setTitleGl(e.target.value)} placeholder="Titulo en galego" />
              </div>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Slug y plantilla"
            description="El slug es la parte de la URL y la plantilla define el diseno de la pagina."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Slug *</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="info-practica" />
                {slug && (
                  <span className="field-hint">
                    Vista previa: {WEB_BASE}/es/<strong>{slug}</strong>
                  </span>
                )}
              </div>
              <div className="form-field">
                <label>Plantilla</label>
                <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                  {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {selectedTemplate && (
                  <span className="field-hint">{selectedTemplate.desc}</span>
                )}
              </div>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* STEP 2 — Contenido */}
      {currentStep === 1 && (
        <>
          <WizardFieldGroup
            title="Contenido en castellano"
            description="El cuerpo principal de la pagina. Puedes usar HTML basico para dar formato."
            tip="Estructura el contenido con parrafos claros. Usa encabezados (<h2>, <h3>) para organizar secciones largas."
          >
            <div className="form-field">
              <textarea rows={10} value={bodyEs} onChange={(e) => setBodyEs(e.target.value)} placeholder="Escribe aqui el contenido de la pagina..." />
              <span className="field-hint">{bodyEs.split(/\s+/).filter(Boolean).length} palabras</span>
            </div>
            <AiWritingAssistant
              text={bodyEs}
              lang="es"
              onAccept={(t) => setBodyEs(t)}
              translationTargets={[
                { lang: 'gl', label: 'Gallego', onAccept: (t) => setBodyGl(t) },
              ]}
            />
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Contenido en gallego"
            description="Traduce o adapta el contenido al gallego."
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
              <button
                type="button"
                className="translate-btn"
                disabled={!bodyEs || !!translating}
                onClick={() => handleTranslate(bodyEs, 'gl', setBodyGl)}
              >
                {translating ? 'Traduciendo...' : 'Traducir automaticamente a GL'}
              </button>
            </div>
            <div className="form-field">
              <textarea rows={10} value={bodyGl} onChange={(e) => setBodyGl(e.target.value)} placeholder="Contido en galego..." />
              <span className="field-hint">{bodyGl.split(/\s+/).filter(Boolean).length} palabras</span>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* STEP 3 — SEO e idiomas */}
      {currentStep === 2 && (
        <>
          <WizardFieldGroup
            title="SEO — Buscadores"
            description="Estos textos aparecen en los resultados de Google."
            tip="Titulo ideal: menos de 60 caracteres. Descripcion ideal: entre 120 y 160 caracteres."
          >
            <div className="form-row">
              <div className="form-field">
                <label>Titulo SEO (ES)</label>
                <input value={seoTitleEs} onChange={(e) => setSeoTitleEs(e.target.value)} />
                <span className={`field-hint ${seoTitleEs.length > 60 ? 'field-hint--warn' : ''}`}>{seoTitleEs.length}/60</span>
              </div>
              <div className="form-field">
                <label>Titulo SEO (GL)</label>
                <input value={seoTitleGl} onChange={(e) => setSeoTitleGl(e.target.value)} />
                <span className={`field-hint ${seoTitleGl.length > 60 ? 'field-hint--warn' : ''}`}>{seoTitleGl.length}/60</span>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Descripcion SEO (ES)</label>
                <textarea rows={2} value={seoDescEs} onChange={(e) => setSeoDescEs(e.target.value)} maxLength={300} />
                <span className={`field-hint ${seoDescEs.length > 160 ? 'field-hint--warn' : ''}`}>{seoDescEs.length}/160</span>
              </div>
              <div className="form-field">
                <label>Descripcion SEO (GL)</label>
                <textarea rows={2} value={seoDescGl} onChange={(e) => setSeoDescGl(e.target.value)} maxLength={300} />
                <span className={`field-hint ${seoDescGl.length > 160 ? 'field-hint--warn' : ''}`}>{seoDescGl.length}/160</span>
              </div>
            </div>
          </WizardFieldGroup>

          <WizardFieldGroup
            title="Traducciones del titulo"
            description="Traduce el titulo a otros idiomas para visitantes internacionales."
          >
            <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-field">
                <label>
                  Titulo (EN)
                  <button type="button" className="translate-btn" disabled={!titleEs || !!translating} onClick={() => handleTranslate(titleEs, 'en', setTitleEn)}>Traducir</button>
                </label>
                <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
              </div>
              <div className="form-field">
                <label>
                  Titulo (FR)
                  <button type="button" className="translate-btn" disabled={!titleEs || !!translating} onClick={() => handleTranslate(titleEs, 'fr', setTitleFr)}>Traducir</button>
                </label>
                <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} />
              </div>
              <div className="form-field">
                <label>
                  Titulo (PT)
                  <button type="button" className="translate-btn" disabled={!titleEs || !!translating} onClick={() => handleTranslate(titleEs, 'pt', setTitlePt)}>Traducir</button>
                </label>
                <input value={titlePt} onChange={(e) => setTitlePt(e.target.value)} />
              </div>
            </div>
          </WizardFieldGroup>
        </>
      )}

      {/* STEP 4 — Revision */}
      {currentStep === 3 && (
        <div className="wizard__completion-grid">
          <WizardCompletionCard
            title="Datos basicos"
            icon="📄"
            onEdit={() => setCurrentStep(0)}
            items={[
              { label: 'Titulo (ES)', value: titleEs, status: titleEs ? 'complete' : 'incomplete' },
              { label: 'Titulo (GL)', value: titleGl, status: titleGl ? 'complete' : 'warning' },
              { label: 'Slug', value: slug, status: slug ? 'complete' : 'incomplete' },
              { label: 'Plantilla', value: selectedTemplate?.label || template, status: 'complete' },
            ]}
          />

          <WizardCompletionCard
            title="Contenido"
            icon="✏️"
            onEdit={() => setCurrentStep(1)}
            items={[
              { label: 'Contenido ES', value: bodyEs ? `${bodyEs.split(/\s+/).filter(Boolean).length} palabras` : '', status: bodyEs ? 'complete' : 'warning' },
              { label: 'Contenido GL', value: bodyGl ? `${bodyGl.split(/\s+/).filter(Boolean).length} palabras` : '', status: bodyGl ? 'complete' : 'warning' },
            ]}
          />

          <WizardCompletionCard
            title="SEO"
            icon="🌐"
            onEdit={() => setCurrentStep(2)}
            items={[
              { label: 'Titulo SEO ES', value: seoTitleEs, status: seoTitleEs ? 'complete' : 'warning' },
              { label: 'Desc SEO ES', value: seoDescEs ? `${seoDescEs.length} chars` : '', status: seoDescEs ? 'complete' : 'warning' },
              { label: 'Ingles', value: titleEn ? 'Traducido' : '', status: titleEn ? 'complete' : 'warning' },
              { label: 'Frances', value: titleFr ? 'Traducido' : '', status: titleFr ? 'complete' : 'warning' },
              { label: 'Portugues', value: titlePt ? 'Traducido' : '', status: titlePt ? 'complete' : 'warning' },
            ]}
          />
        </div>
      )}
    </Wizard>
  );
}
