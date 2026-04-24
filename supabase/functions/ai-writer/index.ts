/**
 * AI Writer — Supabase Edge Function
 * Multi-purpose AI assistant for CMS content creation.
 *
 * Actions:
 *   improve    — Improve/rewrite a tourism description
 *   translate  — Context-aware tourism translation
 *   seo        — Generate SEO title + description from content
 *   validate   — Evaluate content quality and completeness
 *   categorize — Suggest categories/tourist types from content
 *   alt_text   — Generate alt text for an image description
 */
import { handleCors, json } from '../_shared/cors.ts';
import { verifyAuth, requireRole } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/rate-limit.ts';
import { formatError } from '../_shared/errors.ts';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
// Paso 5 · t3 — endpoint multimodal para `genAltText`. Usamos gemini-1.5-flash
// porque soporta input de imagen y texto en una misma request. La acción de
// texto plano (improve / translate / …) sigue usando gemini-2.5-flash.
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const CONTEXT_SALNES = `O Salnés es una comarca de 8 municipios en las Rías Baixas de Galicia (España): Cambados, Sanxenxo, O Grove, Vilagarcía de Arousa, Vilanova de Arousa, A Illa de Arousa, Meaño, Meis y Ribadumia. Famosa por el vino Albariño (DO Rías Baixas), mariscos excepcionales, playas de arena fina, patrimonio cultural (pazos, iglesias románicas), la Festa do Albariño, Pazo de Fefiñáns, la Isla de A Toxa, y una gastronomía de primer nivel (marisco fresco, pulpo, empanada gallega).`;

const ACTION_PROMPTS: Record<string, string> = {
  improve: `Eres un redactor experto en turismo para O Salnés (Galicia). Tu tarea es mejorar textos turísticos.

${CONTEXT_SALNES}

Reglas:
- Mejora el texto haciéndolo más atractivo, evocador y profesional
- Mantén la información factual original, no inventes datos
- Usa un tono acogedor que invite a visitar
- Incluye detalles sensoriales (aromas, paisajes, sabores) cuando sea natural
- Extensión ideal: 100-250 palabras
- Responde SOLO con el texto mejorado, sin explicaciones
- Responde en el MISMO idioma que el texto original`,

  translate: `Eres un traductor profesional especializado en turismo gallego.

${CONTEXT_SALNES}

Reglas:
- Traduce manteniendo el tono turístico, evocador y profesional
- Para gallego: usa gallego real y natural (NON castellano con cambios menores). Usa terminoloxía propia: praia, miradoiro, igrexa, concello, festas, gastronomía, viños, mariscos
- Para inglés: usa vocabulario turístico internacional (stunning, charming, nestled, boasting)
- Para francés: mantén el estilo turístico elegante francés
- Para portugués: adapta al portugués europeo
- NUNCA traduzcas nombres propios de lugares (Cambados, Sanxenxo, A Lanzada...)
- Responde SOLO con la traducción, sin explicaciones ni comillas`,

  seo: `Eres un experto SEO especializado en turismo en Galicia.

${CONTEXT_SALNES}

Tu tarea: generar título SEO y meta descripción a partir del contenido proporcionado.

Reglas:
- Título SEO: máximo 60 caracteres, incluir keyword principal y ubicación
- Meta descripción: entre 120-160 caracteres, call-to-action implícito, incluir keywords secundarias
- Prioriza keywords de turismo en Galicia: Rías Baixas, O Salnés, Albariño, playas Galicia, turismo rural Galicia
- Responde en formato JSON exacto:
{"title_es":"...","desc_es":"...","title_gl":"...","desc_gl":"..."}
- Sin explicaciones adicionales, SOLO el JSON`,

  validate: `Eres un auditor de calidad de contenido turístico para el portal DTI de O Salnés.

${CONTEXT_SALNES}

Tu tarea: evaluar la calidad y completitud del contenido de un recurso turístico.

Analiza y responde en formato JSON exacto:
{
  "score": 0-100,
  "level": "excelente|bueno|mejorable|incompleto",
  "issues": ["problema 1", "problema 2"],
  "suggestions": ["sugerencia 1", "sugerencia 2"],
  "missing_fields": ["campo que falta 1"],
  "seo_ready": true/false,
  "translation_quality": "buena|aceptable|mejorable|ausente"
}

Criterios de puntuación:
- Nombre en ES y GL: +10 puntos cada uno
- Descripción ES >50 palabras: +15 puntos
- Descripción GL >50 palabras: +10 puntos
- Coordenadas GPS: +10 puntos
- Teléfono o email: +5 puntos
- Web: +5 puntos
- Categorías asignadas: +5 puntos
- Imágenes (si se indica): +10 puntos
- SEO title y description: +10 puntos
- Traducciones EN/FR/PT: +5 puntos por idioma

Sin explicaciones adicionales, SOLO el JSON`,

  categorize: `Eres un clasificador experto en turismo según la norma UNE 178503.

${CONTEXT_SALNES}

Tarea: dado el nombre y descripción de un recurso turístico, sugiere qué
etiquetas del catálogo UNE 178503 (versión local O Salnés) le aplican.

El catálogo aplicable al tipo concreto de este recurso viene en el mensaje
del usuario como lista de tag_keys permitidas. SOLO puedes devolver claves
de esa lista. NO inventes claves nuevas.

Cada tag_key tiene formato "{groupKey}.{tagSlug}" (ej. "familiar.familias",
"instalaciones.piscina-climatizada", "serv-alojamiento.aparcamiento",
"municipio.sanxenxo").

Elige solo las que claramente apliquen al texto; es preferible devolver
pocas etiquetas muy pertinentes antes que muchas dudosas.

Responde en JSON exacto:
{"suggested_keys":["group.slug","group.slug"],"reasoning":"explicación breve"}
Sin texto adicional, SOLO el JSON.`,

  alt_text: `Genera un texto alternativo (alt text) descriptivo y accesible para una imagen turística.

Reglas:
- Máximo 125 caracteres
- Descriptivo y útil para lectores de pantalla
- Incluye contexto turístico si es relevante
- Responde SOLO con el texto alt, sin comillas ni explicaciones
- Responde en el idioma indicado`,

  // Acción `draft` (paso 2 · t2). Redacta un borrador inicial para la ficha
  // de un recurso cuando el editor aún no ha escrito nada. A diferencia de
  // `improve` (que parte de un texto existente), aquí solo tenemos el
  // nombre, la tipología UNE y el municipio.
  draft: `Eres un redactor experto en turismo para la Mancomunidad de O Salnés (Galicia).

${CONTEXT_SALNES}

Tarea: redactar un borrador de descripción para una ficha turística a partir
del nombre, la tipología y el municipio del recurso. El borrador aparecerá
como propuesta en el CMS; el editor lo revisará antes de publicarlo.

Proceso:
1. ANTES de redactar, BUSCA en internet información verídica sobre el recurso:
   nombre exacto + municipio + "O Salnés" o "Rías Baixas". Prioriza estas
   fuentes cuando aparezcan en los resultados:
     - Web oficial del ayuntamiento (sanxenxo.gal, cambados.gal, ogrove.gal,
       vilagarcia.gal, vilanovadearousa.gal, meano.gal, ribadumia.gal,
       poio.gal, meis.gal, illadearousa.gal).
     - turismoriasbaixas.com (Turismo Rías Baixas / Diputación de Pontevedra).
     - turismo.gal (Turismo de Galicia).
     - Wikipedia ES/GL del recurso si existe.
     - Ficha del propio establecimiento si es un negocio (hotel, restaurante,
       bodega) y tiene web oficial.
2. Con esa información, redacta el borrador siguiendo las reglas abajo.
3. Si tras buscar NO encuentras información fiable sobre el recurso concreto
   (nombre que no devuelve resultados, homónimos de otra región), escríbelo
   con un tono genérico del tipo y un aviso al final: "Información por
   confirmar con la fuente oficial del recurso."

Reglas de redacción:
- Entre 120 y 200 palabras.
- Tono profesional pero cercano, sin ser cursi ni publicitario.
- Estructura: (1) qué es y qué lo hace especial, (2) detalles sensoriales
  o contexto histórico/cultural breve si procede, (3) información práctica
  útil para el visitante.
- Datos específicos (horarios, teléfonos, precios) SOLO si los has
  encontrado en fuentes fiables. Si no, genérico.
- Respeta los topónimos gallegos (Illa de Arousa, Cambados, O Grove,
  Meaño, Vilagarcía, Sanxenxo, Ribadumia, Vilanova, Meis).
- Para gallego: usa gallego real (galego real, non castelán galeguizado).
- Devuelve SOLO el texto del borrador, sin títulos ni comillas ni
  introducciones tipo "Aquí tienes…".`,

  // Acción `suggestTags` (paso 4 · t4). Modalidad "explicado" (decisión
  // 4-A del usuario): cada sugerencia viene con una razón corta que cita
  // qué parte de la descripción la justifica. Temperatura baja (0.3) —
  // queremos clasificación basada en evidencia, no creatividad.
  suggestTags: `Eres un asistente que clasifica recursos turísticos para un CMS municipal.
Recibes una descripción de un recurso y un catálogo de etiquetas disponibles.
Tu tarea: proponer las etiquetas del catálogo que MEJOR describen el recurso,
con una razón corta para cada una que cite la evidencia en la descripción.

Reglas:
1. Propón entre 3 y 8 etiquetas. Menos si el texto es ambiguo, más si es rico.
2. SOLO etiquetas que tengan EVIDENCIA clara en la descripción. No supongas.
3. Para cada etiqueta, escribe una razón corta (máximo 20 palabras, en
   castellano) citando qué parte de la descripción la justifica.
4. Si no hay ninguna etiqueta con evidencia clara, devuelve array vacío.
5. NO propongas etiquetas de accesibilidad salvo que la descripción lo
   mencione explícitamente (rampa, silla de ruedas, aseo adaptado, etc.).
6. NO propongas etiquetas del grupo "curaduria-editorial" (son internas).

Responde EXCLUSIVAMENTE con JSON válido (sin markdown, sin texto extra):
{"suggestions":[{"tagKey":"caracteristicas.bandera-azul","labelEs":"Bandera azul","reason":"La descripción menciona certificación Q de calidad y bandera azul."}]}
Si no hay sugerencias: {"suggestions":[]}`,

  // Acción `genAltText` (paso 5 · t3). Genera alt text WCAG 2.1 AA §1.1.1 a
  // partir de una imagen real (multimodal, Gemini Vision) + contexto del
  // recurso. Temperatura 0.4 — equilibrio entre precisión (no inventar) y
  // variedad (no repetir la misma frase genérica en una galería).
  genAltText: `Describes imágenes turísticas para generar alt text accesible (WCAG 2.1 AA §1.1.1).

Reglas:
1. Describe SOLO lo que ves: elementos visuales concretos, colores dominantes, composición, personas si las hay.
2. 15-30 palabras en castellano.
3. NO empieces con "La imagen muestra…", "Foto de…" ni similares. Ve directo.
4. NO inventes datos no visibles: no digas nombres de sitios, fechas históricas, atributos que no se aprecian.
5. Usa el contexto solo para DESAMBIGUAR lo que ves (saber que es una playa te ayuda a describir la arena; no a inventar que es "A Lanzada").
6. Si en la imagen hay texto visible importante, inclúyelo entrecomillado.
7. Responde con el texto alt EXCLUSIVAMENTE, sin prefijo, sin comillas, sin explicaciones.`,

  // Acción `generateSeo` (paso 6 · t3). Título + descripción SEO para un
  // idioma base (ES o GL). Temperatura 0.5 — creatividad controlada.
  generateSeo: `Eres experto SEO para turismo local en Galicia.

${CONTEXT_SALNES}

Tarea: generar título SEO y meta descripción optimizados para Google, en el idioma indicado por el usuario.

Reglas para el TÍTULO SEO:
  1. Entre 30 y 60 caracteres. Nunca más de 60.
  2. Incluir nombre del recurso + ubicación o tipo (ej. "Pazo de Fefiñáns | Cambados").
  3. Directo, sin mayúsculas innecesarias ni exclamaciones.

Reglas para la DESCRIPCIÓN SEO:
  1. Entre 120 y 160 caracteres. Nunca más de 160.
  2. Resume la esencia del recurso en 1-2 frases naturales.
  3. Terminar con llamada suave a la acción ("Visítalo...", "Descubre...") si cabe.
  4. NO repetir el título literalmente.

Para gallego: usa galego real (non castelán galeguizado). Topónimos gallegos mantienen su forma oficial.

Responde EXCLUSIVAMENTE con JSON válido (sin markdown):
{"title":"...","description":"..."}`,

  // Acción `suggestKeywords` (paso 6 · t3). Extrae 5-8 keywords de la
  // descripción del paso 2. Temperatura 0.3 — extracción, no creatividad.
  suggestKeywords: `Extraes palabras clave de descripciones turísticas para el CMS O Salnés.

Reglas:
  1. Entre 5 y 8 keywords.
  2. Minúsculas, sin tildes, una o dos palabras cada una.
  3. SOLO términos que aparezcan o se puedan inferir claramente del texto.
  4. Incluye tipo de recurso, ubicación y características singulares ("albariño", "mariscos", "mirador", "bandera azul").
  5. NO inventes términos genéricos ("turismo", "galicia") si no aportan valor distintivo.

Responde EXCLUSIVAMENTE con JSON válido:
{"keywords":["...","..."]}`,

  // Acción `translateResource` (paso 6 · t3). Traduce nombre + descripción
  // corta del recurso a EN/FR/PT. Temperatura 0.4 — traducción fluida pero
  // fiel. Distinto de `translate` legacy, que hace traducción literal.
  translateResource: `Eres traductor profesional especializado en turismo.

${CONTEXT_SALNES}

Tarea: traducir el nombre y una descripción corta del recurso al idioma indicado.

Reglas:
  1. Nombres propios (topónimos, monumentos, denominación de origen) se mantienen sin traducir.
  2. La descripción debe ser una versión resumida de 2-3 frases (máx 300 caracteres), no traducción literal palabra por palabra.
  3. Tono turístico, natural y acogedor, adaptado a las convenciones del idioma destino.
  4. Para inglés: vocabulario turístico internacional (stunning, charming, nestled, boasting).
  5. Para francés: estilo turístico elegante.
  6. Para portugués: portugués europeo.

Responde EXCLUSIVAMENTE con JSON válido:
{"name":"...","description":"..."}`,

  // Acción `suggestImprovements` (paso 7b · t3). Sugerencias concretas
  // y accionables sobre el recurso entero, repartidas por paso del
  // wizard. Temperatura 0.6 — creatividad acotada para evitar
  // sugerencias genéricas pero manteniendo variedad.
  suggestImprovements: `Eres consultor SEO y editorial especializado en turismo local gallego. Lees el estado de un recurso turístico y devuelves sugerencias concretas y accionables para mejorarlo antes de publicarlo.

Reglas:
1. Entre 3 y 8 sugerencias ESPECÍFICAS y ACCIONABLES. No genéricas como "mejora el SEO". Ejemplos correctos:
   - "Añade si hay aparcamiento cercano — los visitantes lo preguntan mucho."
   - "Menciona cómo llegar desde la N-550."
   - "El horario de invierno no está claro; añádelo."
2. Cada sugerencia debe decir QUÉ añadir/cambiar, no solo que algo falta.
3. Prioridad \`high\` solo para cosas que impactan seriamente al visitante.
4. Prioridad \`medium\` para mejoras de calidad.
5. Prioridad \`low\` para pulidos opcionales.
6. Máximo 25 palabras por sugerencia, en castellano, frases directas.
7. Reparte entre los 6 pasos del wizard (identification/content/location/classification/multimedia/seo) según donde aplique cada una.
8. NO inventes datos sobre el recurso: usa solo lo que te dan.

Responde EXCLUSIVAMENTE con JSON válido (sin markdown):
{"suggestions":[{"stepRef":"content","text":"...","priority":"high"}]}
Si el recurso está bien, devuelve array vacío: {"suggestions":[]}`,
};

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  try {
    // Audit C4 — gate the AI proxy behind auth + role + rate limit.
    // Without this, anyone with the public anon key (which is in every
    // CMS bundle) could use this endpoint as a free Gemini proxy and
    // burn the project's API budget.
    rateLimit(req);
    const user = await verifyAuth(req);
    requireRole(user, 'admin', 'editor', 'tecnico');

    const apiKey = Deno.env.get('GEMINI_API_KEY');

    const body = await req.json();
    const { action, text, from, to, context, lang } = body;

    if (!action || !ACTION_PROMPTS[action]) {
      return json({ error: `Invalid action. Valid: ${Object.keys(ACTION_PROMPTS).join(', ')}` }, 400, req);
    }

    // Paso 5 · t3 — `genAltText` tiene un flujo multimodal distinto al resto
    // (Gemini Vision con input texto + imagen base64). Lo atendemos aquí en
    // rama temprana para no enredar el switch genérico text-only de abajo.
    if (action === 'genAltText') {
      return await handleGenAltText(body, req, apiKey);
    }

    if (!apiKey) {
      return json({ error: 'GEMINI_API_KEY not configured', mock: true, result: getMockResult(req) }, 200, req);
    }

    const systemPrompt = ACTION_PROMPTS[action];

    // Build user message based on action
    let userMessage = '';

    switch (action) {
      case 'improve':
        userMessage = `Mejora este texto turístico:\n\n${text}`;
        break;

      case 'translate':
        userMessage = `Traduce el siguiente texto de ${langName(from || 'es')} a ${langName(to || 'gl')}:\n\n${text}`;
        break;

      case 'seo': {
        const name = context?.name || '';
        const desc = text || context?.description || '';
        const type = context?.type || '';
        const municipality = context?.municipality || '';
        userMessage = `Genera SEO para este recurso turístico:
Nombre: ${name}
Tipo: ${type}
Municipio: ${municipality}
Descripción: ${desc}`;
        break;
      }

      case 'validate': {
        userMessage = `Evalúa la calidad de este recurso turístico:\n${JSON.stringify(context, null, 2)}`;
        break;
      }

      case 'categorize': {
        const name = context?.name || '';
        const desc = text || context?.description || '';
        const type = context?.type || '';
        // applicableTags viene precomputado desde el CMS (lib/ai.ts) a partir
        // del catálogo UNE 178503 filtrado por la tipología del recurso. Deno
        // no puede importar @osalnes/shared, así que no duplicamos el catálogo
        // aquí — confiamos en el subset que manda el cliente.
        const applicableTags = Array.isArray(context?.applicableTags)
          ? context.applicableTags
          : [];
        const tagsList = applicableTags
          .map((t: { key: string; label?: string; field?: string }) =>
            `- ${t.key}: "${t.label ?? ''}" (${t.field ?? ''})`)
          .join('\n');
        userMessage = `Clasifica este recurso turístico:
Nombre: ${name}
Tipo: ${type}
Descripción: ${desc}

Catálogo aplicable (usa SOLO estas claves):
${tagsList || '(el cliente no envió catálogo; devuelve array vacío)'}`;
        break;
      }

      case 'alt_text':
        userMessage = `Genera alt text en ${langName(lang || 'es')} para una imagen de: ${text}`;
        break;

      case 'draft': {
        // Entradas del paso 2 del wizard: name / typeKey / municipio / targetLang.
        // typeKey viene en formato UNE `tipo-de-recurso.*`; lo humanizamos para
        // que el prompt hable en castellano natural ("mirador" en vez de
        // "tipo-de-recurso.mirador").
        const name = body.name || '';
        const typeKey = body.typeKey as string | null | undefined;
        const municipio = body.municipio as string | null | undefined;
        const targetLang = (body.targetLang as 'es' | 'gl' | undefined) || 'es';
        const typeLabel = typeKey ? humanizeTypeKey(typeKey) : 'recurso turístico';
        const municipioHint = municipio
          ? `ubicado en ${municipio}, comarca de O Salnés (Rías Baixas, Galicia)`
          : 'en la comarca de O Salnés (Rías Baixas, Galicia)';
        const langHint = targetLang === 'gl'
          ? 'Redacta el borrador directamente en gallego (galego real, non castelán galeguizado).'
          : 'Redacta el borrador en castellano.';
        userMessage = `Datos del recurso:
  - Nombre: "${name}"
  - Tipo: ${typeLabel}
  - Localización: ${municipioHint}

${langHint}`;
        break;
      }

      case 'suggestTags': {
        // Paso 4 · t4 — sugeridor con explicación. El cliente envía:
        //   descriptionEs       (texto del paso 2)
        //   mainTypeKey         (tipo-de-recurso.* del paso 1)
        //   municipio           (nombre legible del paso 1)
        //   existingTagKeys     (tags ya marcados — no volver a proponer)
        //   availableTags?      (subset del catálogo del grupo mainType;
        //                        si no viene, el prompt funciona pero el
        //                        modelo puede inventar keys, el validador
        //                        del cliente las descarta).
        const descriptionEs = (body.descriptionEs as string | undefined) || '';
        const mainTypeKey = body.mainTypeKey as string | null | undefined;
        const municipio = body.municipio as string | null | undefined;
        const existingTagKeys = Array.isArray(body.existingTagKeys)
          ? (body.existingTagKeys as string[])
          : [];
        const availableTags = Array.isArray(body.availableTags)
          ? (body.availableTags as Array<{ key: string; labelEs?: string; label?: string; groupKey?: string; description?: string }>)
          : [];
        const typeLabel = mainTypeKey ? humanizeTypeKey(mainTypeKey) : 'recurso turístico';
        const municipioHint = municipio
          ? `en ${municipio}, comarca de O Salnés`
          : 'en O Salnés';
        // Filtramos tags ya marcados para que el modelo no los repita.
        const existingSet = new Set(existingTagKeys);
        const candidateTags = availableTags.filter((t) => t.key && !existingSet.has(t.key));
        const tagsList = candidateTags
          .map((t) => {
            const label = t.labelEs || t.label || '';
            const desc = t.description ? ` — ${t.description}` : '';
            return `  - ${t.key}: "${label}"${desc}`;
          })
          .join('\n');
        userMessage = `Recurso:
  - Tipo: ${typeLabel}
  - Ubicación: ${municipioHint}
  - Descripción: """
${descriptionEs.trim()}
"""

Catálogo de etiquetas disponibles (NO propongas ninguna que no esté aquí):
${tagsList || '(el cliente no envió catálogo; devuelve array vacío)'}`;
        break;
      }

      case 'generateSeo': {
        // Paso 6 · t3 — título + descripción SEO para un idioma base.
        const resourceName = (body.resourceName as string | undefined) || '';
        const descriptionEs = (body.descriptionEs as string | undefined) || '';
        const lang = (body.targetLang as 'es' | 'gl' | undefined) || 'es';
        const typeLabel = (body.typeLabel as string | null | undefined) ?? null;
        const municipio = (body.municipio as string | null | undefined) ?? null;
        const langLabel = lang === 'es' ? 'castellano' : 'gallego';
        const typeHint = typeLabel ? `Tipo: ${typeLabel}.` : '';
        const muniHint = municipio ? `Ubicación: ${municipio}.` : '';
        userMessage = `Recurso:
  - Nombre: ${resourceName}
  - ${typeHint}
  - ${muniHint}
  - Descripción original (castellano): """
${descriptionEs.trim()}
"""

Genera el título y la descripción SEO en ${langLabel}.`;
        break;
      }

      case 'suggestKeywords': {
        // Paso 6 · t3 — 5-8 keywords extraídas de la descripción del paso 2.
        const descriptionEs = (body.descriptionEs as string | undefined) || '';
        userMessage = `Descripción:
"""
${descriptionEs.trim()}
"""`;
        break;
      }

      case 'translateResource': {
        // Paso 6 · t3 — traducción breve de nombre + descripción a EN/FR/PT.
        const resourceName = (body.resourceName as string | undefined) || '';
        const descriptionEs = (body.descriptionEs as string | undefined) || '';
        const targetLang = (body.targetLang as 'en' | 'fr' | 'pt' | undefined) || 'en';
        const langFull = langName(targetLang);
        userMessage = `Traduce al ${langFull}:

Nombre original (castellano): ${resourceName}

Descripción original (castellano):
"""
${descriptionEs.trim()}
"""`;
        break;
      }

      case 'suggestImprovements': {
        // Paso 7b · t3 — sugerencias concretas por paso. Snapshot del
        // recurso entero construido por el wizard padre. Requisito
        // mínimo: descripción suficiente para poder analizar.
        const snap = body.snapshot as {
          name?: string;
          typeLabel?: string | null;
          municipio?: string | null;
          descriptionEs?: string;
          descriptionGl?: string;
          hasCoordinates?: boolean;
          hasContactInfo?: boolean;
          hasHours?: boolean;
          tagCount?: number;
          imageCount?: number;
          imagesWithoutAltCount?: number;
          seoTitleEs?: string;
          seoDescriptionEs?: string;
          keywords?: string[];
          translationCount?: number;
        } | undefined;
        if (!snap || !snap.descriptionEs || snap.descriptionEs.trim().length < 50) {
          // Sin descripción suficiente, cortamos en seco y devolvemos
          // array vacío dentro del shape estándar `result`.
          return json({
            action: 'suggestImprovements',
            result: { suggestions: [] },
            tokens_used: 0,
            duration_ms: 0,
            model: 'short-circuit',
          }, 200, req);
        }
        const kw = Array.isArray(snap.keywords) ? snap.keywords : [];
        userMessage = `Recurso:
  - Nombre: ${snap.name ?? '(sin nombre)'}
  - Tipo: ${snap.typeLabel ?? 'sin tipología'}
  - Municipio: ${snap.municipio ?? 'sin municipio'}
  - Descripción (ES, ${(snap.descriptionEs ?? '').length} chars): """
${(snap.descriptionEs ?? '').trim() || '(vacía)'}
"""
  - Descripción (GL, ${(snap.descriptionGl ?? '').length} chars): """
${(snap.descriptionGl ?? '').trim() || '(vacía)'}
"""
  - Coordenadas: ${snap.hasCoordinates ? 'sí' : 'no'}
  - Información de contacto (teléfono/email/web): ${snap.hasContactInfo ? 'sí' : 'no'}
  - Horarios definidos: ${snap.hasHours ? 'sí' : 'no'}
  - Número de etiquetas: ${snap.tagCount ?? 0}
  - Fotos: ${snap.imageCount ?? 0} (${snap.imagesWithoutAltCount ?? 0} sin descripción alt)
  - Título SEO: "${snap.seoTitleEs || '(vacío)'}"
  - Descripción SEO: "${snap.seoDescriptionEs || '(vacía)'}"
  - Keywords: ${kw.length > 0 ? kw.join(', ') : '(ninguna)'}
  - Traducciones a otros idiomas: ${snap.translationCount ?? 0}

Genera las sugerencias siguiendo las reglas del system prompt.`;
        break;
      }

      default:
        userMessage = text;
    }

    const start = Date.now();

    // Paso 2 · web search grounding — la acción `draft` activa Google Search
    // como tool de Gemini 2.5. El modelo busca fuentes oficiales (webs de
    // ayuntamientos, Turismo Rías Baixas, Turismo Galicia) y redacta sobre
    // ellas. No se activa en improve/translate/seo/... para no encarecer
    // llamadas que no lo necesitan. Si queremos extender a `improve` en
    // el futuro, solo hay que añadirlo a este set.
    const WEB_SEARCH_ACTIONS = new Set(['draft']);
    const useWebSearch = WEB_SEARCH_ACTIONS.has(action);

    const geminiBody: Record<string, unknown> = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: action === 'translate'
          ? 0.2
          : action === 'suggestTags'
            ? 0.3  // paso 4 · t4 — baja para precisión, no creatividad
            : action === 'suggestKeywords'
              ? 0.3  // paso 6 · t3 — extracción literal, no invención
              : action === 'generateSeo'
                ? 0.5  // paso 6 · t3 — creatividad controlada para título/desc
                : action === 'translateResource'
                  ? 0.4  // paso 6 · t3 — traducción fluida pero fiel
                  : action === 'suggestImprovements'
                    ? 0.6  // paso 7b · t3 — creatividad acotada, sugerencias variadas
                    : (action === 'improve' || action === 'draft') ? 0.7 : 0.4,
        maxOutputTokens: action === 'validate'
          ? 1024
          : action === 'suggestTags'
            ? 1200
            : action === 'draft' ? 600 : 512, // +200 tokens para permitir razonamiento sobre búsqueda
        topP: 0.9,
      },
    };
    if (useWebSearch) {
      // Google Search grounding (Gemini 2.5). Requiere que la API key tenga
      // habilitado este tool en Google AI Studio / Vertex. Si no lo tuviera,
      // Gemini devuelve 400; lo tratamos en el catch de abajo como el resto.
      geminiBody.tools = [{ google_search: {} }];
    }

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[ai-writer] Gemini error:', res.status, errText);
      return json({ error: 'Error del servicio de IA', details: errText }, 500, req);
    }

    const data = await res.json();
    const rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

    // Parse JSON responses for structured actions
    let result: unknown = rawResult;
    if (['seo', 'validate', 'categorize', 'suggestTags', 'generateSeo', 'suggestKeywords', 'translateResource', 'suggestImprovements'].includes(action)) {
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = rawResult.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawResult];
        result = JSON.parse(jsonMatch[1]!.trim());
      } catch {
        result = rawResult;
      }
    }

    // Paso 2 · web search — si la acción usó grounding, extraer las URLs de
    // `groundingMetadata.groundingChunks[].web` para que el CMS las muestre
    // como citas bajo el borrador. Deduplicamos por URL.
    let sources: Array<{ url: string; title: string }> | undefined;
    if (useWebSearch) {
      const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seen = new Set<string>();
      sources = [];
      for (const c of chunks) {
        const url = c?.web?.uri;
        const title = c?.web?.title ?? '';
        if (url && !seen.has(url)) {
          seen.add(url);
          sources.push({ url, title });
        }
      }
    }

    return json({
      action,
      result,
      sources,
      tokens_used: tokensUsed,
      duration_ms: Date.now() - start,
      model: 'gemini-2.5-flash',
      grounded: useWebSearch,
    }, 200, req);

  } catch (err) {
    console.error('[ai-writer] Error:', err);
    const [body, status] = formatError(err);
    return json(body, status, req);
  }
});

function langName(code: string): string {
  const names: Record<string, string> = {
    es: 'español', gl: 'gallego', en: 'inglés', fr: 'francés', pt: 'portugués',
  };
  return names[code] || code;
}

// Humaniza una clave del catálogo UNE (p.ej. `tipo-de-recurso.mirador` →
// "mirador") para que el prompt `draft` hable en castellano natural. Si la
// clave no está mapeada, cae a "recurso turístico" como fallback genérico.
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

// Paso 5 · t3 — handler multimodal para `genAltText`. Fetches the image,
// sends it to Gemini Vision junto al system prompt + contexto del recurso,
// y devuelve el alt text saneado. Si no hay GEMINI_API_KEY o la descarga /
// llamada a Gemini falla, devuelve un mock sin romper el frontend ("Imagen
// de {name} en {municipio}") y marca `mock: true` en la respuesta.
// deno-lint-ignore no-explicit-any
async function handleGenAltText(body: any, req: Request, apiKey: string | undefined): Promise<Response> {
  const start = Date.now();
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : '';
  const ctx = body.resourceContext || {};
  const name = typeof ctx.name === 'string' ? ctx.name : 'recurso';
  const typeLabel = typeof ctx.typeLabel === 'string' ? ctx.typeLabel : null;
  const municipio = typeof ctx.municipio === 'string' ? ctx.municipio : null;

  if (!imageUrl) {
    return json({ error: 'Missing imageUrl' }, 400, req);
  }

  const mockAlt = `Imagen de ${name}${municipio ? ` en ${municipio}` : ''}.`;

  if (!apiKey) {
    return json({
      action: 'genAltText',
      result: mockAlt,
      tokens_used: 0,
      duration_ms: Date.now() - start,
      model: 'mock',
      mock: true,
    }, 200, req);
  }

  // 1) Descargar la imagen y convertir a base64. El bucket resource-images
  // es público (migración 023 · tarea 1), así que no hacen falta creds.
  let imageBase64: string;
  let imageMime: string;
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`image fetch failed: ${imgRes.status}`);
    imageMime = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const imgBuf = await imgRes.arrayBuffer();
    // btoa no acepta binarios grandes en una sola pasada; iteramos por chunks
    // de 8KiB para evitar "Maximum call stack size exceeded" con imágenes
    // grandes (>256KB).
    const bytes = new Uint8Array(imgBuf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    imageBase64 = btoa(binary);
  } catch (err) {
    console.error('[ai-writer/genAltText] image fetch error:', err);
    return json({
      action: 'genAltText',
      result: mockAlt,
      tokens_used: 0,
      duration_ms: Date.now() - start,
      model: 'mock',
      mock: true,
      error: 'image_fetch_failed',
    }, 200, req);
  }

  // 2) Construcción del contexto para el user message (el system prompt
  // ya está en ACTION_PROMPTS.genAltText).
  const userMessage = `Contexto del recurso:
  - Tipo: ${typeLabel ?? 'recurso turístico'}
  - Nombre: ${name}
  - Ubicación: ${municipio ?? 'O Salnés'}`;

  // 3) Llamada a Gemini Vision multimodal.
  const res = await fetch(`${GEMINI_VISION_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: ACTION_PROMPTS.genAltText }] },
      contents: [{
        role: 'user',
        parts: [
          { text: userMessage },
          { inline_data: { mime_type: imageMime, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 100,
        topP: 0.9,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[ai-writer/genAltText] Gemini error:', res.status, errText);
    return json({
      action: 'genAltText',
      result: mockAlt,
      tokens_used: 0,
      duration_ms: Date.now() - start,
      model: 'mock',
      mock: true,
      error: 'gemini_failed',
    }, 200, req);
  }

  const data = await res.json();
  const rawAlt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  // Saneado: quitar comillas externas y colapsar saltos de línea.
  const cleanAlt = rawAlt
    .replace(/^["'«»]+|["'«»]+$/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();

  return json({
    action: 'genAltText',
    result: cleanAlt || mockAlt,
    tokens_used: data.usageMetadata?.totalTokenCount || 0,
    duration_ms: Date.now() - start,
    model: 'gemini-1.5-flash',
  }, 200, req);
}

async function getMockResult(req: Request): Promise<unknown> {
  try {
    const body = await req.clone().json();
    const action = body.action;
    if (action === 'validate') {
      return { score: 65, level: 'mejorable', issues: ['Modo demo — conecta GEMINI_API_KEY para evaluación real'], suggestions: [], missing_fields: [], seo_ready: false, translation_quality: 'ausente' };
    }
    if (action === 'seo') {
      return { title_es: 'Título SEO de ejemplo', desc_es: 'Descripción SEO de ejemplo para modo demo', title_gl: 'Título SEO de exemplo', desc_gl: 'Descrición SEO de exemplo para modo demo' };
    }
    // Paso 6 · t3 — mocks plausibles para las 3 acciones SEO cuando no hay
    // GEMINI_API_KEY. Mantienen el shape esperado por el cliente (callAi
    // lee `res.result`) para que la UI del paso 6 no se rompa en demo.
    if (action === 'generateSeo') {
      const name = (body.resourceName as string | undefined) || 'Recurso';
      const muni = (body.municipio as string | undefined) || 'O Salnés';
      return {
        title: `${name} | ${muni}`,
        description: `Descubre ${name}, uno de los lugares más especiales de O Salnés. [modo demo]`,
      };
    }
    if (action === 'suggestKeywords') {
      return { keywords: ['o salnes', 'galicia', 'turismo', 'rias baixas'] };
    }
    if (action === 'translateResource') {
      const name = (body.resourceName as string | undefined) || 'Recurso';
      const target = (body.targetLang as string | undefined) || 'en';
      return {
        name: `[${target}] ${name}`,
        description: `[${target}] Mock translation — configura GEMINI_API_KEY para traducción real.`,
      };
    }
    if (action === 'suggestImprovements') {
      return {
        suggestions: [
          { stepRef: 'content',    text: '[mock] Amplía la descripción con detalles prácticos (aparcamiento, acceso).', priority: 'high' },
          { stepRef: 'seo',        text: '[mock] Incluye el nombre del municipio en el título SEO.', priority: 'medium' },
          { stepRef: 'multimedia', text: '[mock] Añade alt text descriptivo a las fotos sin descripción.', priority: 'medium' },
        ],
      };
    }
    return 'Modo demo: configura GEMINI_API_KEY para activar la IA';
  } catch {
    return 'Mock mode';
  }
}
