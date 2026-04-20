import { useEffect, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { aiImprove } from '@/lib/ai';

/**
 * RichTextEditor — Editor WYSIWYG con TipTap
 * Reemplaza textareas planos con formato enriquecido y ayuda IA inline.
 */

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Subset de botones a mostrar en la toolbar. Reconocidos: bold, italic,
   *  h2, h3, ul, ol, link, quote, undo, redo. Si se omite, se muestran todos.
   *  Uso por el rediseño del paso 2 (no implementado todavía: la toolbar
   *  sigue enseñando los botones completos). */
  toolbar?: string[];
  /** Cuando true, bloquea la interacción con el editor. Lo consume
   *  ResourceWizardStep2Content mientras corre una acción IA. Implementación
   *  mínima: aplica pointer-events: none al contenedor. */
  disabled?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 200, disabled = false }: RichTextEditorProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'rte-link', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Escribe aqui...',
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. when AI applies improved text)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const wordCount = editor.getText().split(/\s+/).filter(Boolean).length;

  async function handleImproveSelection() {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const selectedText = empty
      ? editor.getText()
      : editor.state.doc.textBetween(from, to, ' ');

    if (!selectedText.trim()) {
      setAiError('Selecciona texto o escribe algo para mejorar');
      setTimeout(() => setAiError(null), 3000);
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const improved = await aiImprove(selectedText);
      if (empty) {
        // No selection — replace whole content
        editor.commands.setContent(`<p>${improved.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`);
      } else {
        // Replace selection
        editor.chain().focus().insertContentAt({ from, to }, improved).run();
      }
    } catch (err: any) {
      setAiError(err.message);
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setAiLoading(false);
    }
  }

  function handleSetLink() {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL del enlace:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div
      className="rte"
      style={{
        minHeight,
        ...(disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined),
      }}
      aria-disabled={disabled || undefined}
    >
      <Toolbar editor={editor} onImprove={handleImproveSelection} onLink={handleSetLink} aiLoading={aiLoading} />
      <EditorContent editor={editor} className="rte__content" />
      <div className="rte__footer">
        <span className="rte__count">{wordCount} palabras</span>
        {aiError && <span className="rte__error">{aiError}</span>}
      </div>
    </div>
  );
}

interface ToolbarProps {
  editor: Editor;
  onImprove: () => void;
  onLink: () => void;
  aiLoading: boolean;
}

function Toolbar({ editor, onImprove, onLink, aiLoading }: ToolbarProps) {
  return (
    <div className="rte__toolbar">
      <button
        type="button"
        className={`rte__btn ${editor.isActive('bold') ? 'rte__btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Negrita (Ctrl+B)"
      >
        <strong>B</strong>
      </button>

      <button
        type="button"
        className={`rte__btn ${editor.isActive('italic') ? 'rte__btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Cursiva (Ctrl+I)"
      >
        <em>I</em>
      </button>

      <span className="rte__sep" />

      <button
        type="button"
        className={`rte__btn ${editor.isActive('heading', { level: 2 }) ? 'rte__btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Titulo grande"
      >
        H2
      </button>

      <button
        type="button"
        className={`rte__btn ${editor.isActive('heading', { level: 3 }) ? 'rte__btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Subtitulo"
      >
        H3
      </button>

      <span className="rte__sep" />

      <button
        type="button"
        className={`rte__btn ${editor.isActive('bulletList') ? 'rte__btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Lista"
      >
        •
      </button>

      <button
        type="button"
        className={`rte__btn ${editor.isActive('orderedList') ? 'rte__btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Lista numerada"
      >
        1.
      </button>

      <span className="rte__sep" />

      <button
        type="button"
        className={`rte__btn ${editor.isActive('link') ? 'rte__btn--active' : ''}`}
        onClick={onLink}
        title="Enlace"
      >
        🔗
      </button>

      <button
        type="button"
        className={`rte__btn ${editor.isActive('blockquote') ? 'rte__btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Cita"
      >
        ❝
      </button>

      <span className="rte__sep" />

      <button
        type="button"
        className="rte__btn"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Deshacer (Ctrl+Z)"
      >
        ↶
      </button>

      <button
        type="button"
        className="rte__btn"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Rehacer (Ctrl+Y)"
      >
        ↷
      </button>

      <div className="rte__toolbar-spacer" />

      <button
        type="button"
        className="rte__btn rte__btn--ai"
        onClick={onImprove}
        disabled={aiLoading}
        title="Mejorar texto seleccionado con IA (o todo si no hay seleccion)"
      >
        {aiLoading ? '...' : '✨ Mejorar con IA'}
      </button>
    </div>
  );
}

// Default export para consumidores nuevos (p.ej. ResourceWizardStep2Content).
// El named export se mantiene por compat con RichTextEditor referenciado en otros sitios.
export default RichTextEditor;
