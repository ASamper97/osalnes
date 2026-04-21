// ──────────────────────────────────────────────────────────────────────────
// PATCH · supabase/functions/ai-writer/index.ts
//
// Añade la acción `genAltText` al Edge Function para generar descripciones
// alt (WCAG 2.1 AA) usando Gemini Vision.
// ──────────────────────────────────────────────────────────────────────────


// ═══════════ 1) AÑADIR 'genAltText' AL TIPO Action ═══════════

// En la declaración del tipo Action:
//   type Action = 'draft' | 'improve' | ... | 'suggestTags';
// Añadir:
type Action =
  | 'draft'
  | 'improve'
  | 'translate'
  | 'seo'
  | 'validate'
  | 'categorize'
  | 'alt_text'
  | 'suggestTags'
  | 'genAltText'; // ← NUEVO


// ═══════════ 2) TIPOS DE ENTRADA ═══════════

interface GenAltTextInput {
  action: 'genAltText';
  imageUrl: string;
  resourceContext: {
    name: string;
    typeLabel: string | null;
    municipio: string | null;
  };
}


// ═══════════ 3) BUILDER DEL PROMPT ═══════════

function buildGenAltTextPrompt(ctx: GenAltTextInput['resourceContext']): string {
  const typeLabel = ctx.typeLabel ?? 'recurso turístico';
  const municipio = ctx.municipio ?? 'O Salnés';

  return `Describe esta imagen en 15-30 palabras en castellano para ayudar a una persona ciega a entender qué muestra. Esto es un alt text WCAG 2.1 AA.

Contexto:
  - Tipo: ${typeLabel}
  - Nombre: ${ctx.name}
  - Ubicación: ${municipio}

Reglas:
  1. Describe SOLO lo que ves en la imagen: elementos visuales concretos, colores dominantes, composición, personas si las hay.
  2. NO empieces por "La imagen muestra...", "Foto de..." ni similares. Ve directo.
  3. NO inventes datos que no sean visibles: no digas nombres de sitios, fechas históricas, atributos que no se ven.
  4. Usa el contexto solo para DESAMBIGUAR lo que ves (ej. saber que es una playa te ayuda a describir la arena).
  5. Si en la imagen hay texto visible importante, inclúyelo entrecomillado.
  6. Responde con el texto alt EXCLUSIVAMENTE, sin prefijo, sin comillas, sin explicaciones.`;
}


// ═══════════ 4) HANDLER (case del switch) ═══════════
/*
case 'genAltText': {
  const input = body as GenAltTextInput;

  if (!input.imageUrl) {
    return jsonResponse({ altText: '' }, 400);
  }

  // Fetch de la imagen y conversión a base64 para Gemini Vision
  let imageBase64: string;
  let imageMime: string;
  try {
    const imgRes = await fetch(input.imageUrl);
    if (!imgRes.ok) throw new Error('Image fetch failed');
    imageMime = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const imgBuf = await imgRes.arrayBuffer();
    imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
  } catch {
    return jsonResponse({ altText: '' }, 500);
  }

  const prompt = buildGenAltTextPrompt(input.resourceContext);

  // Llamada a Gemini con partes mixtas (texto + imagen)
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    // Fallback mock sin coste (para desarrollo)
    return jsonResponse({
      altText: `[mock] Imagen de ${input.resourceContext.name} en ${input.resourceContext.municipio ?? 'O Salnés'}.`,
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: imageMime, data: imageBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 100,
      },
    }),
  });

  if (!geminiRes.ok) return jsonResponse({ altText: '' }, 500);
  const geminiData = await geminiRes.json();
  const altText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  // Saneado: quitar comillas y saltos de línea
  const clean = altText
    .replace(/^["'«»]|["'«»]$/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  return jsonResponse({ altText: clean });
}
*/


// ═══════════ 5) TEMPERATURA ═══════════
//
// 0.4 — equilibrio entre precisión (no inventar) y variedad (no repetir
// la misma frase genérica en todas las imágenes de una galería).


// ═══════════ 6) LÍMITES ═══════════
//
// maxOutputTokens: 100 — sobra para 15-30 palabras. Con 100 tokens nos
// aseguramos que la respuesta no se corta a media frase si la IA se
// excede.


// ═══════════ 7) TEST MANUAL ═══════════
//
// curl -X POST "$SUPABASE_URL/functions/v1/ai-writer" \
//   -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "action":"genAltText",
//     "imageUrl":"https://.../playa.jpg",
//     "resourceContext":{
//       "name":"Praia da Lanzada",
//       "typeLabel":"Playa",
//       "municipio":"Sanxenxo"
//     }
//   }'
// → { "altText": "Arena fina dorada extendida bajo cielo despejado, con olas suaves rompiendo en la orilla y dunas al fondo." }
