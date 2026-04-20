/**
 * TemplatePicker — pantalla de entrada "¿Cómo quieres empezar?"
 *
 * Sustituye al picker actual (cuyas tarjetas usaban tags inventados) por
 * uno que conecta con el catálogo UNE 178503 real:
 *
 *   - Cada plantilla declara su `mainTagKey` (del grupo `tipo-de-recurso.*`)
 *     y sus `initialTagKeys` (del catálogo).
 *   - Al hacer clic, el wizard arranca con esos tags ya marcados, saltando
 *     el desplegable inconsistente de "Tipología principal" del paso 1.
 *   - La opción "Importar desde URL con IA" queda intacta (la gestiona
 *     otro componente aparte).
 *   - La opción "Empezar en blanco" ahora abre el wizard sin tipología
 *     preseleccionada — el paso 1 fuerza al editor a elegir una de los 18
 *     tags del grupo `tipo-de-recurso.*` antes de avanzar.
 *
 * Props:
 *   onPick(templateKey) — se llama cuando el usuario elige una plantilla.
 *                         El padre navega a /resources/new?template={key}
 *                         y el ResourceWizardPage hidrata su estado con
 *                         resolveTemplateTags(key).
 *   onImportFromUrl()   — abre el flujo de "Importar desde URL con IA".
 *   onCancel()          — vuelve al listado de recursos.
 */

import {
  RESOURCE_TEMPLATES,
  type ResourceTemplate,
} from '@osalnes/shared/data/resource-templates';

export interface TemplatePickerProps {
  onPick: (templateKey: string) => void;
  onImportFromUrl: () => void;
  onCancel: () => void;
}

function TemplateCard({
  template,
  onPick,
}: {
  template: ResourceTemplate;
  onPick: (key: string) => void;
}) {
  return (
    <button
      type="button"
      className={`template-card${template.isBlank ? ' template-card--blank' : ''}`}
      onClick={() => onPick(template.key)}
      aria-label={`Crear recurso a partir de la plantilla ${template.label}`}
    >
      <div className="template-card-icon" aria-hidden>
        {template.icon}
      </div>
      <h3 className="template-card-title">{template.label}</h3>
      <p className="template-card-desc">{template.description}</p>
      {!template.isBlank && template.initialTagKeys.length > 0 && (
        <div className="template-card-tags">
          <span className="template-card-tags-count">
            {template.initialTagKeys.length + 1} etiquetas pre-aplicadas
          </span>
        </div>
      )}
      {template.isBlank && (
        <div className="template-card-tags">
          <span className="template-card-tags-count template-card-tags-count--blank">
            Máxima flexibilidad
          </span>
        </div>
      )}
    </button>
  );
}

export default function TemplatePicker({
  onPick,
  onImportFromUrl,
  onCancel,
}: TemplatePickerProps) {
  const sorted = [...RESOURCE_TEMPLATES].sort((a, b) => a.order - b.order);
  const regular = sorted.filter((t) => !t.isBlank);
  const blank = sorted.find((t) => t.isBlank);

  return (
    <div className="template-picker">
      <header className="template-picker-header">
        <div>
          <h1>¿Cómo quieres empezar?</h1>
          <p>
            Elige una plantilla con campos y etiquetas UNE 178503 pre-configuradas, importa los
            datos desde una web, o empieza desde cero.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </header>

      {/* Bloque destacado: import por IA */}
      <button
        type="button"
        className="template-import-cta"
        onClick={onImportFromUrl}
        aria-label="Importar recurso desde una URL con asistencia de IA"
      >
        <div className="template-import-cta-icon" aria-hidden>
          ✨
        </div>
        <div className="template-import-cta-body">
          <strong>Importar desde una URL con IA</strong>
          <span>
            Pega la web de un negocio o un perfil de TripAdvisor y la IA rellenará los campos
            automáticamente
          </span>
        </div>
        <div className="template-import-cta-arrow" aria-hidden>
          →
        </div>
      </button>

      <div className="template-picker-divider">
        <span>O ELIGE UNA PLANTILLA</span>
      </div>

      <div className="template-grid">
        {regular.map((t) => (
          <TemplateCard key={t.key} template={t} onPick={onPick} />
        ))}
        {blank && <TemplateCard key={blank.key} template={blank} onPick={onPick} />}
      </div>
    </div>
  );
}
