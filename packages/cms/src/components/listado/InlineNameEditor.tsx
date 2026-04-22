/**
 * InlineNameEditor — edición inline del nombre
 *
 * Input con Enter = guardar, Escape = cancelar.
 * Requiere valor no vacío.
 */

import { useEffect, useRef, useState } from 'react';
import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.inlineEdit;

export interface InlineNameEditorProps {
  initialValue: string;
  onSave: (newValue: string) => Promise<void>;
  onCancel: () => void;
}

export default function InlineNameEditor({ initialValue, onSave, onCancel }: InlineNameEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('No puede estar vacío.');
      return;
    }
    if (trimmed === initialValue) {
      onCancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
    } catch {
      setError(COPY.saveError);
      setSaving(false);
    }
  };

  return (
    <div className="list-inline-editor">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={COPY.namePlaceholder}
        disabled={saving}
        className="list-inline-editor-input"
        aria-label={COPY.editTitle}
      />
      <div className="list-inline-editor-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? '…' : COPY.saveLabel}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
          disabled={saving}
        >
          {COPY.cancelLabel}
        </button>
      </div>
      {error && <div className="list-inline-editor-error" role="alert">{error}</div>}
    </div>
  );
}
