/**
 * AiPreview — previsualización de una propuesta IA antes de aplicarla
 *
 * La IA nunca sobreescribe lo que el usuario ha escrito. Siempre muestra
 * su propuesta en un bloque aparte, con disclaimer honesto ("esto lo ha
 * escrito una IA"), y deja al usuario decidir con dos botones claros.
 */

export interface AiPreviewProps {
  heading: string;
  disclaimer: string;
  text: string;
  applyLabel: string;
  discardLabel: string;
  onApply: () => void;
  onDiscard: () => void;
}

export default function AiPreview({
  heading,
  disclaimer,
  text,
  applyLabel,
  discardLabel,
  onApply,
  onDiscard,
}: AiPreviewProps) {
  return (
    <div className="ai-preview" role="region" aria-label={heading}>
      <header className="ai-preview-head">
        <h4>
          <span aria-hidden>✨</span> {heading}
        </h4>
        <p className="ai-preview-disclaimer">{disclaimer}</p>
      </header>

      <div className="ai-preview-body">
        <p>{text}</p>
      </div>

      <footer className="ai-preview-foot">
        <button type="button" className="btn btn-ghost" onClick={onDiscard}>
          {discardLabel}
        </button>
        <button type="button" className="btn btn-primary" onClick={onApply}>
          {applyLabel}
        </button>
      </footer>
    </div>
  );
}
