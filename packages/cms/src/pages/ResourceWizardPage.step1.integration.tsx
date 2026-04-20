// ──────────────────────────────────────────────────────────────────────────
// INTEGRACIÓN PASO 1 · ResourceWizardPage.tsx (rediseño limpieza v2.1)
//
// Este fichero NO se commitea tal cual. Son los fragmentos que sustituyen
// al bloque actual del paso 1 "Identificación" en
// `packages/cms/src/pages/ResourceWizardPage.tsx`.
//
// Cambios que aplica:
//   1. Sustituye el desplegable legacy de "Tipología principal" (~40
//      valores inventados) por <MainTypeSelector>.
//   2. ELIMINA el desplegable "Tipologías secundarias" (era un tercer
//      vocabulario sin conectar). Los subtipos se gestionan ahora en el
//      paso 4 como tags del catálogo UNE.
//   3. Esconde el campo "Slug" detrás de un <details> "Editar slug".
//   4. Filtra el desplegable "Zona" por el municipio seleccionado.
//   5. Añade ayuda contextual explicando qué es una zona.
// ──────────────────────────────────────────────────────────────────────────


// ═══════════ 1) IMPORTS nuevos al principio del fichero ═══════════

import MainTypeSelector from '../components/MainTypeSelector';
import '../components/main-type-selector.css';
// Si el proyecto usa CSS por componente:
// import '../components/main-type-selector.css';


// ═══════════ 2) ESTADO: cambiar el modelo de tipología ═══════════

// BORRAR el estado legacy:
//    const [tipologyMain, setTipologyMain] = useState('...');
//    const [tipologySecondary, setTipologySecondary] = useState<string[]>([]);
//
// AÑADIR:
const [mainTypeKey, setMainTypeKey] = useState<string | null>(
  () => {
    // Hidratación desde el recurso existente o desde la plantilla
    if (initialResource?.tags) {
      const mainTag = initialResource.tags.find(
        (t: { tag_key: string }) => t.tag_key.startsWith('tipo-de-recurso.'),
      );
      if (mainTag) return mainTag.tag_key;
    }
    // Si venimos de una plantilla (?template=hotel), resolver aquí
    const tpl = searchParams.get('template');
    if (tpl) {
      // resolveTemplateTags viene del paso siguiente — ya metido en tagKeys
      // El primer tag del template es el mainTagKey
    }
    return null;
  },
);

// Si el estado `tagKeys` del paso 4 ya existe (sesión anterior), sincronizar:
// al cambiar mainTypeKey hay que asegurar que el tag está en tagKeys (el
// TagSelector del paso 4 lo muestra como "ya marcado").
useEffect(() => {
  if (!mainTypeKey) return;
  setTagKeys((prev) => (prev.includes(mainTypeKey) ? prev : [...prev, mainTypeKey]));
}, [mainTypeKey]);


// ═══════════ 3) ZONAS filtradas por MUNICIPIO ═══════════

// El estado actual probablemente es:
//    const [municipio, setMunicipio] = useState<string>('');
//    const [zona, setZona] = useState<string>('');
//
// El loader inicial carga TODAS las zonas. Hay que cargarlas filtradas.

const [allMunicipios, setAllMunicipios] = useState<Array<{ id: string; name: string }>>([]);
const [zonasForMunicipio, setZonasForMunicipio] = useState<Array<{ id: string; name: string }>>([]);

// Carga inicial de municipios (una sola vez)
useEffect(() => {
  (async () => {
    const { data } = await supabase.from('municipios').select('id, name').order('name');
    if (data) setAllMunicipios(data);
  })();
}, []);

// Cada vez que cambia el municipio, recargar zonas/parroquias filtradas
useEffect(() => {
  if (!municipio) {
    setZonasForMunicipio([]);
    setZona('');   // limpiar zona si quitan municipio
    return;
  }
  (async () => {
    const { data } = await supabase
      .from('zonas')
      .select('id, name')
      .eq('municipio_id', municipio)
      .order('name');
    if (data) {
      setZonasForMunicipio(data);
      // Si la zona actual no pertenece al nuevo municipio, limpiarla
      if (zona && !data.find((z) => z.id === zona)) {
        setZona('');
      }
    }
  })();
}, [municipio]);   // eslint-disable-line react-hooks/exhaustive-deps


// ═══════════ 4) RENDER del paso 1 · reemplazo completo ═══════════

// ANTES (a borrar en ResourceWizardPage.tsx):
//   <WizardFieldGroup title="Tipología principal" ...>
//     <select value={tipologyMain} onChange={...}>
//       <option>Atractivo turistico (recurso)</option>
//       <option>Playa (recurso)</option>
//       ...40 opciones...
//     </select>
//     <details><summary>Tipologías secundarias (0)</summary>
//       <input type="checkbox" ...>ApartHotel</input>
//       ...50 checkboxes...
//     </details>
//   </WizardFieldGroup>
//
// DESPUÉS:

<WizardFieldGroup
  title="Tipología"
  tip="La tipología determina qué campos y etiquetas te pide el wizard más adelante. Si tu recurso encaja en varios tipos, elige el principal ahora; los matices se añaden en el paso 4 como etiquetas."
>
  <MainTypeSelector
    value={mainTypeKey}
    onChange={setMainTypeKey}
    helperText="Elige la tipología que mejor describa el recurso. Son los 18 tipos oficiales UNE 178503."
  />
</WizardFieldGroup>

<WizardFieldGroup
  title="Nombre del recurso"
  tip="El nombre principal tal como se mostrará en la web y en buscadores."
>
  <div className="field-grid-2">
    <label>
      <span className="field-label">Nombre (ES) *</span>
      <input
        type="text"
        value={nameEs}
        onChange={(e) => setNameEs(e.target.value)}
        placeholder="Ej: Mirador de A Lanzada"
        required
      />
    </label>
    <label>
      <span className="field-label">
        Nombre (GL) <button type="button" className="btn-inline">Traducir a GL</button>
      </span>
      <input
        type="text"
        value={nameGl}
        onChange={(e) => setNameGl(e.target.value)}
        placeholder="Ej: Miradoiro de A Lanzada"
      />
    </label>
  </div>
  <p className="field-tip">
    💡 Usa el nombre oficial o el más reconocible. Ejemplo: "Mirador de A Lanzada", no "mirador lanzada".
  </p>
</WizardFieldGroup>

<WizardFieldGroup
  title="Municipio y zona"
  tip="Localización administrativa del recurso. La zona es la parroquia o zona turística dentro del municipio — ayuda a que el buscador y el mapa filtren con precisión."
>
  <div className="field-grid-2">
    <label>
      <span className="field-label">Municipio *</span>
      <select value={municipio} onChange={(e) => setMunicipio(e.target.value)} required>
        <option value="">-- Sin municipio --</option>
        {allMunicipios.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
    <label>
      <span className="field-label">
        Zona / Parroquia
        {municipio && zonasForMunicipio.length === 0 && (
          <span className="field-label-hint">(sin zonas registradas para este municipio)</span>
        )}
      </span>
      <select
        value={zona}
        onChange={(e) => setZona(e.target.value)}
        disabled={!municipio || zonasForMunicipio.length === 0}
      >
        <option value="">
          {!municipio
            ? '-- Elige municipio primero --'
            : zonasForMunicipio.length === 0
            ? '-- Sin zonas --'
            : '-- Sin zona --'}
        </option>
        {zonasForMunicipio.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
          </option>
        ))}
      </select>
    </label>
  </div>
</WizardFieldGroup>

{/* Slug: escondido detrás de un <details> para no distraer a técnicos municipales */}
<details className="wizard-advanced">
  <summary>⚙️ Editar slug (URL amigable)</summary>
  <div className="wizard-advanced-body">
    <label>
      <span className="field-label">Slug</span>
      <input
        type="text"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="se-genera-automaticamente"
      />
      <p className="field-tip">
        Es la parte final de la URL pública: <code>osalnes.com/recursos/<strong>{slug || 'mirador-a-lanzada'}</strong></code>.
        Se genera automáticamente desde el nombre. Solo edítalo si sabes lo que haces (cambios rompen enlaces antiguos).
      </p>
    </label>
  </div>
</details>


// ═══════════ 5) VALIDACIÓN del paso 1 ═══════════

// La regla pasa a ser: mainTypeKey obligatorio, nameEs obligatorio,
// municipio obligatorio. Zona es opcional. Slug se auto-genera.
const step1Valid = useMemo(
  () => !!mainTypeKey && nameEs.trim().length > 0 && !!municipio,
  [mainTypeKey, nameEs, municipio],
);

// En el botón "Siguiente" del Wizard:
<button
  type="button"
  className="btn btn-primary"
  disabled={!step1Valid}
  onClick={nextStep}
>
  Siguiente →
</button>


// ═══════════ 6) GUARDADO: el mainType va a resource_tags ═══════════

// En handleSubmit, tras guardar el recurso:
async function saveResourceTags(resourceId: string) {
  // Construir el array completo de keys a persistir
  const allKeys = Array.from(new Set([
    ...(mainTypeKey ? [mainTypeKey] : []),   // tipología principal
    ...tagKeys,                              // tags del paso 4
  ]));

  // Borrar todos los tags actuales y reinsertar (delete-all + insert)
  await supabase.from('resource_tags').delete().eq('resource_id', resourceId);

  if (allKeys.length === 0) return;

  const rows = allKeys
    .map((k) => TAGS_BY_KEY[k])
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({
      resource_id: resourceId,
      tag_key: t.key,
      field: t.field,
      value: t.value,
      pid_exportable: t.pidExportable,
      source: 'manual',
    }));

  const { error } = await supabase.from('resource_tags').insert(rows);
  if (error) throw error;
}

// Nota: ya NO escribir en la columna legacy `tipology_main`. La migración
// 019 ha añadido un trigger que emite warnings si alguien lo hace.
