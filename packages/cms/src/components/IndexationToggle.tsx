/**
 * IndexationToggle — toggle "Visible en buscadores" (decisión 4-A)
 *
 * Componente simple: un checkbox grande con explicación contextual. Por
 * defecto está activado (indexable = true). Al desactivarlo, aparece un
 * aviso explicativo para que el usuario entienda qué está haciendo.
 */

import { STEP6_COPY } from '../pages/step6-seo.copy';

const COPY = STEP6_COPY.indexation;

export interface IndexationToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
}

export default function IndexationToggle({ value, onChange }: IndexationToggleProps) {
  return (
    <section className="indexation-toggle">
      <header>
        <h4>{COPY.sectionTitle}</h4>
      </header>

      <label className="indexation-switch">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="indexation-switch-slider" aria-hidden />
        <span className="indexation-switch-label">{COPY.toggleLabel}</span>
      </label>

      <p className={`indexation-hint ${value ? 'is-on' : 'is-off'}`}>
        {value ? COPY.toggleHintOn : COPY.toggleHintOff}
      </p>
    </section>
  );
}
