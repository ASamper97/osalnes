#!/usr/bin/env node
/**
 * Importador de imágenes desde osalnes.com (web vieja).
 *
 * Los 1.151 recursos cargados del CSV tienen campo `url` apuntando a
 * osalnes.com, que contiene galerías en /images/galleries/{N}/{hash}.ext.
 * El importador original no trasladó esas imágenes a Supabase Storage,
 * y `resource_images` está vacío. Este script:
 *
 *   1. DRY RUN (default):
 *        - Recorre todos los recursos con `url` poblada.
 *        - Fetch + parseo HTML → extrae URLs de galería (filtra banners,
 *          logos, iconos, mapas Google Static).
 *        - Genera CSV `scripts/out/imagenes_propuesta.csv` con resumen.
 *        - NO descarga imágenes, NO toca BD ni Storage.
 *
 *   2. --apply:
 *        - Descarga cada candidato (HEAD + GET).
 *        - Sube a bucket `resource-images` en `{resource_id}/{hash}.{ext}`.
 *        - Inserta fila en `resource_images` con is_primary=true para la
 *          primera de cada recurso, resto con sort_order creciente.
 *        - alt_text = '' (se completa después en paso 5 con aiGenAltText).
 *
 * Uso:
 *   node scripts/importar_imagenes.mjs            # dry-run
 *   node scripts/importar_imagenes.mjs --apply    # ejecuta cambios
 *   node scripts/importar_imagenes.mjs --limit 10 # solo primeros 10 (pruebas)
 *
 * Consideraciones:
 *   - Delay ~400ms entre requests a osalnes.com para no saturar la web.
 *   - En --apply evitamos duplicados: si ya existe un storage_path para
 *     un recurso, lo saltamos (idempotente por si hay que reanudar).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(__dirname, 'out');

// ─── .env loader ────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env');
  const txt = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1] || '0', 10) : 0;

const FETCH_DELAY_MS = 400;      // entre páginas de osalnes.com
const DOWNLOAD_DELAY_MS = 150;   // entre descargas de imágenes
const MAX_IMAGES_PER_RESOURCE = 8; // cap para no explotar en recursos con muchas

// ─── REST Supabase ──────────────────────────────────────────────────────
async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`REST ${path} → ${res.status}: ${body}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function fetchAll(path, pageSize = 1000) {
  const rows = [];
  let offset = 0;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await rest(`${path}${sep}offset=${offset}&limit=${pageSize}`);
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }
  return rows;
}

// ─── Scraper de imágenes ────────────────────────────────────────────────
function extractImageUrls(html) {
  // Combina <img src=...>, <img data-src=...> (lazy loading usado por osalnes)
  // y cualquier referencia en atributos a rutas /images/galleries/...
  const urls = new Set();
  const patterns = [
    /<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi,
  ];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) urls.add(m[1]);
  }
  // Filtrar solo galerías — excluimos banners (cabeceras de sección),
  // videos (thumbnails genéricos), logos, iconos, mapas y otros.
  const filtered = [];
  for (const u of urls) {
    if (!/\/images\/galleries\/\d+\/[A-Za-z0-9]+\.(jpe?g|png|webp|gif)$/i.test(u)) continue;
    filtered.push(u);
  }
  // Deduplicar manteniendo el orden de aparición.
  return [...new Set(filtered)];
}

function absolutize(url, base = 'https://osalnes.com') {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return base + url;
  return base + '/' + url;
}

async function scrapePage(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 osalnes-dti-import' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, status: res.status, images: [] };
    const html = await res.text();
    const images = extractImageUrls(html).slice(0, MAX_IMAGES_PER_RESOURCE);
    return { ok: true, status: 200, images: images.map((u) => absolutize(u)) };
  } catch (err) {
    return { ok: false, status: 0, images: [], error: err.message };
  }
}

// ─── Descarga y upload a Supabase Storage ───────────────────────────────
async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 osalnes-dti-import' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  return { buf, mime };
}

async function uploadToStorage(storagePath, buf, mime) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/resource-images/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'true',
      },
      body: buf,
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`upload ${storagePath} → ${res.status}: ${body}`);
  }
  return `resource-images/${storagePath}`;
}

// ─── CSV helper ─────────────────────────────────────────────────────────
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━ Importador de imágenes osalnes.com ━━━');
  console.log(APPLY ? 'MODO: APPLY (descargará + subirá + insertará)' : 'MODO: DRY RUN (solo CSV)');
  if (LIMIT) console.log(`Límite: primeros ${LIMIT} recursos`);
  console.log('');

  // 1. Recursos con url
  console.log('• Descargando recursos con url…');
  let resources = await fetchAll(
    'recurso_turistico?select=id,slug,url&url=not.is.null&order=slug'
  );
  if (LIMIT > 0) resources = resources.slice(0, LIMIT);
  console.log(`  ${resources.length} recursos a procesar`);

  // 2. resource_images existentes (para idempotencia)
  let existingPathsByResource = new Map(); // resource_id → Set<storage_path>
  if (APPLY) {
    const existing = await fetchAll('resource_images?select=resource_id,storage_path');
    for (const r of existing) {
      if (!existingPathsByResource.has(r.resource_id))
        existingPathsByResource.set(r.resource_id, new Set());
      existingPathsByResource.get(r.resource_id).add(r.storage_path);
    }
    console.log(`  ${existing.length} filas en resource_images ya existentes`);
  }

  // 3. Loop principal
  const out = [];
  const stats = {
    ok: 0,
    sinImagen: 0,
    httpError: 0,
    insertados: 0,
    subidos: 0,
    errores: 0,
    totalImagenes: 0,
  };

  const t0 = Date.now();
  for (let i = 0; i < resources.length; i++) {
    const r = resources[i];
    const progress = `[${String(i + 1).padStart(4)}/${resources.length}]`;
    try {
      const page = await scrapePage(r.url);

      if (!page.ok) {
        stats.httpError++;
        out.push({
          slug: r.slug,
          url_original: r.url,
          num_imagenes: 0,
          primera_imagen: '',
          estado: `http_${page.status || 'error'}`,
          error: page.error ?? '',
        });
        console.log(`${progress} ✗ ${r.slug} (HTTP ${page.status || 'err'})`);
      } else if (page.images.length === 0) {
        stats.sinImagen++;
        out.push({
          slug: r.slug,
          url_original: r.url,
          num_imagenes: 0,
          primera_imagen: '',
          estado: 'sin_imagenes',
          error: '',
        });
        console.log(`${progress} · ${r.slug} (0 fotos)`);
      } else {
        stats.ok++;
        stats.totalImagenes += page.images.length;
        out.push({
          slug: r.slug,
          url_original: r.url,
          num_imagenes: page.images.length,
          primera_imagen: page.images[0],
          estado: 'ok',
          error: '',
        });

        if (APPLY) {
          // Descargar y persistir cada imagen
          const existingSet = existingPathsByResource.get(r.id) ?? new Set();
          for (let idx = 0; idx < page.images.length; idx++) {
            const imgUrl = page.images[idx];
            // storage_path: {resource_id}/{basename}. Dedup por si una
            // imagen se añade dos veces al mismo recurso (no debería).
            const basename = imgUrl.split('/').pop();
            const storagePath = `${r.id}/${basename}`;
            if (existingSet.has(storagePath)) continue;

            try {
              const { buf, mime } = await downloadImage(imgUrl);
              await uploadToStorage(storagePath, buf, mime);
              stats.subidos++;

              await rest('resource_images', {
                method: 'POST',
                headers: { Prefer: 'return=minimal' },
                body: JSON.stringify({
                  resource_id: r.id,
                  storage_path: storagePath,
                  mime_type: mime,
                  size_bytes: buf.length,
                  is_primary: idx === 0,
                  sort_order: idx,
                  alt_text: null,
                }),
              });
              stats.insertados++;
              existingSet.add(storagePath);
              await delay(DOWNLOAD_DELAY_MS);
            } catch (err) {
              stats.errores++;
              console.log(`${progress}   ✗ foto ${idx}: ${err.message}`);
            }
          }
          console.log(`${progress} ✓ ${r.slug} (${page.images.length} fotos)`);
        } else {
          console.log(`${progress} ✓ ${r.slug} (${page.images.length} fotos)`);
        }
      }
    } catch (err) {
      stats.errores++;
      console.log(`${progress} ✗ ${r.slug} EXCEPCIÓN: ${err.message}`);
    }

    await delay(FETCH_DELAY_MS);
  }

  // 4. CSV
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const csvPath = join(OUT_DIR, 'imagenes_propuesta.csv');
  const header = Object.keys(out[0] ?? { slug: '' }).join(',');
  const body = out.map((r) => Object.values(r).map(csvEscape).join(',')).join('\n');
  writeFileSync(csvPath, `﻿${header}\n${body}\n`, 'utf-8');

  // 5. Resumen
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n━━━ Resumen ━━━');
  console.log(`  Recursos procesados:   ${resources.length}`);
  console.log(`  Con imágenes:          ${stats.ok}`);
  console.log(`  Sin imágenes en web:   ${stats.sinImagen}`);
  console.log(`  HTTP error:            ${stats.httpError}`);
  console.log(`  Total fotos detectadas: ${stats.totalImagenes}`);
  console.log(`  Media fotos/recurso:   ${stats.ok ? (stats.totalImagenes / stats.ok).toFixed(1) : '—'}`);
  if (APPLY) {
    console.log(`  Subidas a Storage:     ${stats.subidos}`);
    console.log(`  Filas resource_images: ${stats.insertados}`);
    console.log(`  Errores de descarga:   ${stats.errores}`);
  }
  console.log(`  Tiempo:                ${elapsed}s`);
  console.log(`  CSV:                   ${csvPath}`);
  if (!APPLY) {
    console.log('\n(DRY RUN — no se ha modificado nada. Revisa el CSV y lanza con --apply.)\n');
  }
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
