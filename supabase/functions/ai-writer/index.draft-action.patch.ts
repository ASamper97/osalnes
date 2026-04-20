// ──────────────────────────────────────────────────────────────────────────
// PATCH · supabase/functions/ai-writer/index.ts
//
// Este fichero NO se commitea tal cual. Son los cambios concretos que hay
// que aplicar al Edge Function `ai-writer` para añadir la acción `draft`
// que el rediseño del paso 2 necesita.
//
// La acción existente `improve` asume que ya hay texto del usuario. La
// acción `draft` es nueva: redacta un borrador partiendo de cero usando
// solo nombre + tipología + municipio.
// ──────────────────────────────────────────────────────────────────────────


// ═══════════ 1) Añadir al enum de acciones ═══════════

// En la declaración actual del tipo de action (algo como):
//   type Action = 'improve' | 'translate' | 'seo' | 'validate' | 'categorize' | 'alt_text';
// Añadir 'draft':
type Action =
  | 'draft'       // ← NUEVO
  | 'improve'
  | 'translate'
  | 'seo'
  | 'validate'
  | 'categorize'
  | 'alt_text';


// ═══════════ 2) Input del handler ═══════════

// El handler actual recibe un body. Para la acción 'draft' debe aceptar:
interface DraftInput {
  action: 'draft';
  name: string;                      // nombre del recurso (paso 1)
  typeKey: string | null;            // tag UNE (p.ej. 'tipo-de-recurso.hotel')
  municipio: string | null;          // nombre del municipio
  targetLang: 'es' | 'gl';           // idioma destino del borrador
}


// ═══════════ 3) Prompt especializado ═══════════

function buildDraftPrompt(input: DraftInput): string {
  const typeLabel = input.typeKey
    ? humanizeTypeKey(input.typeKey)
    : 'recurso turístico';

  const municipioHint = input.municipio
    ? `ubicado en ${input.municipio}, comarca de O Salnés (Rías Baixas, Galicia)`
    : 'en la comarca de O Salnés (Rías Baixas, Galicia)';

  const langHint = input.targetLang === 'gl'
    ? 'Redacta el borrador directamente en gallego (galego real, non castelán galeguizado).'
    : 'Redacta el borrador en castellano.';

  return `Eres un redactor experto en turismo de Galicia. Tu tarea: redactar
un borrador de descripción para una ficha turística que se publicará en el
portal de la Mancomunidad de O Salnés.

Datos del recurso:
  - Nombre: "${input.name}"
  - Tipo: ${typeLabel}
  - Localización: ${municipioHint}

Requisitos del borrador:
  - Entre 120 y 200 palabras.
  - Tono profesional pero cercano, sin ser cursi ni publicitario.
  - Estructura: (1) qué es y qué lo hace especial, (2) detalles sensoriales o
    contexto histórico/cultural breve si procede, (3) información práctica
    útil para el visitante.
  - Si no dispones de información específica (horarios exactos, precios,
    teléfonos), NO la inventes: escribe en genérico o sugiere que el visitante
    consulte fuentes oficiales.
  - ${langHint}
  - Respeta los nombres propios y los topónimos gallegos (Illa de Arousa,
    Cambados, O Grove, Meaño, Vilagarcía, Sanxenxo, Ribadumia, Vilanova, Meis…).

Devuelve SOLO el texto del borrador, sin títulos, sin comillas, sin
introducciones tipo "Aquí tienes…".`;
}

// Helper de humanización
function humanizeTypeKey(k: string): string {
  const map: Record<string, string> = {
    'tipo-de-recurso.playa':             'playa',
    'tipo-de-recurso.mirador':           'mirador',
    'tipo-de-recurso.museo':             'museo',
    'tipo-de-recurso.iglesia-capilla':   'iglesia, capilla, ermita o convento',
    'tipo-de-recurso.pazo-arq-civil':    'pazo o edificio civil histórico',
    'tipo-de-recurso.yacimiento-ruina':  'yacimiento arqueológico o ruina',
    'tipo-de-recurso.molino':            'molino o elemento etnográfico',
    'tipo-de-recurso.puerto-lonja':      'puerto o lonja',
    'tipo-de-recurso.espacio-natural':   'espacio natural',
    'tipo-de-recurso.paseo-maritimo':    'paseo marítimo',
    'tipo-de-recurso.ruta':              'ruta de senderismo o itinerario',
    'tipo-de-recurso.bodega':            'bodega DO Rías Baixas',
    'tipo-de-recurso.restaurante':       'restaurante',
    'tipo-de-recurso.hotel':             'hotel',
    'tipo-de-recurso.alojamiento-rural': 'alojamiento rural o casa de aldea',
    'tipo-de-recurso.camping':           'camping',
    'tipo-de-recurso.fiesta-festival':   'fiesta popular o festival',
    'tipo-de-recurso.leyenda':           'leyenda o tradición local',
  };
  return map[k] ?? 'recurso turístico';
}


// ═══════════ 4) Branch en el handler ═══════════

// En el switch del handler principal (donde hoy tienes 'improve',
// 'translate', etc.), añadir el case:
/*
case 'draft': {
  const prompt = buildDraftPrompt(body as DraftInput);
  const result = await callGemini(prompt, { temperature: 0.7, maxTokens: 400 });
  return new Response(JSON.stringify({ text: result }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
*/


// ═══════════ 5) Fallback mock ═══════════
//
// Si tu Edge Function ya tiene un fallback mock para las otras acciones
// cuando no hay GEMINI_API_KEY, replica el mismo patrón para 'draft':
//
// if (!apiKey) {
//   const mockText = `Descripción automática generada para "${input.name}",
//     un ${humanizeTypeKey(input.typeKey ?? '')} en ${input.municipio ?? 'O Salnés'}.
//     [Mock — configurar GEMINI_API_KEY para textos reales]`;
//   return new Response(JSON.stringify({ text: mockText }));
// }


// ═══════════ 6) Temperatura sugerida ═══════════
//
// 0.7 → coherente con 'improve' existente, que también es creativo.
// Si la salida es demasiado florida o inventa datos, bajar a 0.5.


// ═══════════ 7) Tests manuales de aceptación ═══════════
//
// POST /functions/v1/ai-writer con:
//   { "action": "draft", "name": "Mirador de A Lanzada",
//     "typeKey": "tipo-de-recurso.mirador", "municipio": "Sanxenxo",
//     "targetLang": "es" }
// → Debe devolver un borrador de ~150 palabras en español, sin inventarse
//   horarios ni teléfonos, con referencia a la comarca.
//
// POST mismo body con "targetLang": "gl"
// → Debe devolver el borrador directamente en gallego, con topónimos
//   correctos ("Miradoiro", "Illa de Arousa").
