#!/usr/bin/env node
/**
 * Reclasificación de recursos turísticos (Parte 1).
 *
 * Lee los recursos cargados, cruza con el catálogo `tipologia` y propone
 * un `rdf_type` más preciso usando reglas por keywords sobre slug + nombre.
 *
 * Modo por defecto: DRY RUN — genera `scripts/out/reclasificacion_propuesta.csv`
 * y un resumen por consola. NO modifica la base de datos.
 *
 * Para aplicar los cambios tras revisar el CSV:
 *   node scripts/reclasificar_recursos.mjs --apply
 *
 * Usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY del .env de la raíz.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(__dirname, 'out');

// ─── .env loader simplificado ───────────────────────────────────────────
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

const APPLY = process.argv.includes('--apply');

// ─── Helpers REST ───────────────────────────────────────────────────────
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
  // return=minimal puede devolver 201 con body vacío; toleramos ambos casos.
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

// ─── Normalización de texto (para keyword matching) ─────────────────────
function norm(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Mapeo rdf_type (schema.org) → tag UNE 178503 ───────────────────────
// Las 18 tipologías UNE que ve el CMS están en packages/shared/src/data/tag-catalog.ts.
// Los rdf_type schema.org que NO tienen mapeo UNE corresponden a servicios
// del territorio (farmacia, gasolinera, policía…) que no son recursos
// turísticos UNE. Se marcan con review_required=true para que el usuario
// los etiquete después con tipologías nuevas.
const RDFTYPE_TO_UNE = {
  // ── turísticos UNE 18 ──
  Beach: 'tipo-de-recurso.playa',
  ViewPoint: 'tipo-de-recurso.mirador',
  Museum: 'tipo-de-recurso.museo',
  PlaceOfWorship: 'tipo-de-recurso.iglesia-capilla',
  CivilBuilding: 'tipo-de-recurso.pazo-arq-civil',
  LandmarksOrHistoricalBuildings: 'tipo-de-recurso.yacimiento-ruina',
  MilitaryBuilding: 'tipo-de-recurso.yacimiento-ruina',
  Port: 'tipo-de-recurso.puerto-lonja',
  YachtingPort: 'tipo-de-recurso.puerto-lonja',
  NaturePark: 'tipo-de-recurso.espacio-natural',
  Park: 'tipo-de-recurso.espacio-natural',
  Trail: 'tipo-de-recurso.ruta',
  TouristTrip: 'tipo-de-recurso.ruta',
  Winery: 'tipo-de-recurso.bodega',
  Brewery: 'tipo-de-recurso.bodega',
  Restaurant: 'tipo-de-recurso.restaurante',
  BarOrPub: 'tipo-de-recurso.restaurante',
  CafeOrCoffeeShop: 'tipo-de-recurso.restaurante',
  IceCreamShop: 'tipo-de-recurso.restaurante',
  Hotel: 'tipo-de-recurso.hotel',
  Hostel: 'tipo-de-recurso.hotel',
  BedAndBreakfast: 'tipo-de-recurso.hotel',
  ApartHotel: 'tipo-de-recurso.hotel',
  LodgingBusiness: 'tipo-de-recurso.hotel',
  RuralHotel: 'tipo-de-recurso.alojamiento-rural',
  RuralHouse: 'tipo-de-recurso.alojamiento-rural',
  GuestHouse: 'tipo-de-recurso.alojamiento-rural',
  Apartment: 'tipo-de-recurso.alojamiento-rural',
  Campground: 'tipo-de-recurso.camping',
  TraditionalFestival: 'tipo-de-recurso.fiesta-festival',
  Festival: 'tipo-de-recurso.fiesta-festival',
  FoodEvent: 'tipo-de-recurso.fiesta-festival',
  MusicEvent: 'tipo-de-recurso.fiesta-festival',
  Event: 'tipo-de-recurso.fiesta-festival',
  BusinessEvent: 'tipo-de-recurso.fiesta-festival',
  // Ambiguos: paseo-maritimo es el "cajón" para atracciones genéricas
  TouristAttraction: 'tipo-de-recurso.paseo-maritimo',
  // Naturaleza que encaja forzada en espacio-natural
  BodyOfWater: 'tipo-de-recurso.espacio-natural',
  Waterfall: 'tipo-de-recurso.espacio-natural',
  Mountain: 'tipo-de-recurso.espacio-natural',
  Cave: 'tipo-de-recurso.espacio-natural',
  Square: 'tipo-de-recurso.paseo-maritimo',
  District: 'tipo-de-recurso.paseo-maritimo',
  Street: 'tipo-de-recurso.paseo-maritimo',
  // Deporte/náutica no tienen tipo UNE directo; van al sitio más cercano.
  WaterActivityCenter: 'tipo-de-recurso.puerto-lonja',
  SportsActivityLocation: null, // sin mapping claro → revisión
  GolfCourse: null, // revisión (tag experiencia.golf existe pero eso es touristType)

  // ── NO-turísticos (servicios del territorio) ──
  // null = no insertar tag UNE, marcar review_required
  Pharmacy: null,
  Hospital: null,
  PoliceStation: null,
  GasStation: null,
  FinancialService: null,
  BusStation: null,
  BusStop: null,
  TaxiStand: null,
  ParkingFacility: null,
  TrainStation: null,
  Library: null,
  CultureCenter: null,
  ShoppingCenter: null,
  Aquarium: null,
  ArtGallery: null,
  TouristInformationCenter: null,
  TravelAgency: null,
  Organization: null,
  TouristDestination: null,
  Offer: null,
  ExhibitionEvent: null,
  SportsEvent: null,
  Fair: null,
};

// ─── Reglas de reclasificación ──────────────────────────────────────────
/**
 * Cada regla: { match: (haystack, actual) => bool, propose: string, reason: string, requiereCatalogo?: boolean }
 * Se evalúan en orden. La primera que matchea gana.
 * `haystack` = slug + ' ' + name (ambos normalizados).
 * `actual` = rdf_type actual, por si la regla depende del tipo original.
 */
const RULES = [
  // ── Eventos (muchos están como BusinessEvent) ──────────────────────
  // IMPORTANTE: orden específico → genérico.
  {
    match: (h, a) =>
      a === 'BusinessEvent' &&
      /\b(gastronomic|gastronomia|marisco|albarino|albarino|vino|queso|lamprea|empanada|chorizo|pan-de-|filloa|festa-do-vino|festa-do-marisco|festa-do-albari)\b/.test(h),
    propose: 'FoodEvent',
    reason: 'Evento gastronómico → FoodEvent',
  },
  {
    match: (h, a) =>
      a === 'BusinessEvent' && /\b(concerto|concierto|musica|música|festival-de-)\b/.test(h),
    propose: 'MusicEvent',
    reason: 'Evento musical → MusicEvent',
  },
  {
    match: (h, a) =>
      a === 'BusinessEvent' &&
      /\b(festa|fiesta|feira|romaria|romeria|magosto|entroido|carnaval|procesion|procesión|festividade|virxe|san-roque|corpus)\b/.test(h),
    propose: 'TraditionalFestival',
    reason: 'Fiesta/romería/feria tradicional → TraditionalFestival',
  },
  {
    match: (h, a) => a === 'BusinessEvent',
    propose: 'Event',
    reason: 'Evento genérico (no empresarial) → Event',
  },

  // ── Alojamiento (afinar sobre Hotel/Hostel/Apartment) ──────────────
  {
    match: (h) => /\b(aparthotel|apart-hotel)\b/.test(h),
    propose: 'ApartHotel',
    reason: 'Apartahotel → ApartHotel',
  },
  {
    match: (h, a) =>
      (a === 'Hotel' || a === 'Apartment') &&
      /\b(hotel-rural|hotel rural|pazo-hotel)\b/.test(h),
    propose: 'RuralHotel',
    reason: 'Hotel rural/Pazo-hotel → RuralHotel',
  },
  {
    // Solo reclasifica a RuralHouse si NO estaba ya marcado como
    // RuralHotel (respetamos la carga original: "Casa Rural X" puede ser
    // un hotel rural pequeño, no una vivienda de uso turístico pura).
    match: (h, a) =>
      a !== 'RuralHotel' &&
      /\b(casa-rural|casa rural|agroturismo|turismo-rural)\b/.test(h),
    propose: 'RuralHouse',
    reason: 'Casa rural/agroturismo → RuralHouse',
  },
  {
    match: (h, a) =>
      (a === 'Hotel' || a === 'Hostel') &&
      /\b(pension|hostal|b-and-b|bed-and-breakfast)\b/.test(h),
    propose: 'BedAndBreakfast',
    reason: 'Pensión/hostal/B&B → BedAndBreakfast',
  },
  {
    match: (h) => /\b(albergue)\b/.test(h),
    propose: 'Hostel',
    reason: 'Albergue → Hostel',
  },
  {
    match: (h, a) =>
      a === 'Apartment' && /\b(apartamento|apartamentos)\b/.test(h),
    propose: 'Apartment',
    reason: 'Confirmado Apartment',
  },

  // ── Restauración ───────────────────────────────────────────────────
  {
    match: (h, a) => a === 'Restaurant' && /\b(bodega|adega|cava|vinateria)\b/.test(h),
    propose: 'Winery',
    reason: 'Bodega/adega → Winery',
  },
  {
    match: (h, a) =>
      a === 'Restaurant' && /\b(cafe|cafeteria|cafetaria|pasteleria|confiteria)\b/.test(h),
    propose: 'CafeOrCoffeeShop',
    reason: 'Café/cafetería → CafeOrCoffeeShop',
  },
  {
    match: (h, a) =>
      a === 'Restaurant' && /\b(taberna|tasca|pub|cerveceria|cervexeria|bar)\b/.test(h),
    propose: 'BarOrPub',
    reason: 'Bar/taberna/pub → BarOrPub',
  },
  {
    match: (h, a) =>
      a === 'Restaurant' && /\b(heladeria|xelateria)\b/.test(h),
    propose: 'IceCreamShop',
    reason: 'Heladería → IceCreamShop',
  },

  // ── Puertos y costa (mayormente CivilBuilding) ─────────────────────
  {
    // ⚠ "marina" y "nautico" a solas dan falsos positivos ("Santa Mariña",
    //   "Hotel A Mariña", "Turismo Náutico"). Exigimos que el haystack
    //   contenga "puerto" o "club" junto con ellos.
    match: (h, a) =>
      /\b(puerto-deportivo|porto-deportivo|club-nautico|club-náutico|pantalan|real-club-nautico)\b/.test(h) &&
      a !== 'PlaceOfWorship' && a !== 'Hotel',
    propose: 'YachtingPort',
    reason: 'Puerto deportivo → YachtingPort',
  },
  {
    match: (h) => /\b(puerto-pesquero|porto-pesqueiro|lonja|porto)\b/.test(h),
    propose: 'Port',
    reason: 'Puerto pesquero/lonja → Port',
  },

  // ── TouristAttraction (182) — bolsa genérica, desmenuzar ───────────
  // Orden: servicios/empresas muy claros → elementos físicos específicos → naturaleza
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(oficina-de-turismo|oficina-turismo|turismo-de-|tourist-information)\b/.test(h),
    propose: 'TouristInformationCenter',
    reason: 'Oficina de turismo → TouristInformationCenter',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(agencia-de-viaje|agencia-de-viajes|viajes-|viaxes-)\b/.test(h),
    propose: 'TravelAgency',
    reason: 'Agencia de viajes → TravelAgency',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(hotel-|hotel |gran-hotel|gran-talaso|eurostars|nh-)\b/.test(h),
    propose: 'Hotel',
    reason: 'Hotel (estaba como TouristAttraction) → Hotel',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(apartamento|apartamentos|apart-hotel|aparthotel)\b/.test(h),
    propose: 'Apartment',
    reason: 'Apartamentos turísticos → Apartment',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(camping|cámping)\b/.test(h),
    propose: 'Campground',
    reason: 'Camping → Campground',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(restaurante|restaurant|meson|mesón|taberna|asador)\b/.test(h),
    propose: 'Restaurant',
    reason: 'Restaurante (estaba como TouristAttraction) → Restaurant',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(bodega|adega|pazo-de-|cava-|viticola)\b/.test(h),
    propose: 'Winery',
    reason: 'Bodega/adega (estaba como TouristAttraction) → Winery',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(balneario|spa|talasoterapia|termal|wellness)\b/.test(h),
    propose: 'TouristAttraction',
    reason: 'Balneario/SPA: mantener TouristAttraction (no existe HealthClub en catálogo — considerar migración)',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(faro)\b/.test(h),
    propose: 'LandmarksOrHistoricalBuildings',
    reason: 'Faro → LandmarksOrHistoricalBuildings',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(muelle|peirao|embarcadero)\b/.test(h),
    propose: 'Port',
    reason: 'Muelle/embarcadero → Port',
  },
  {
    match: (h, a) => a === 'TouristAttraction' && /\b(mirador|miradoiro|vistas)\b/.test(h),
    propose: 'ViewPoint',
    reason: 'Mirador → ViewPoint',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(ruta|sendeiro|sendero|camino|camino|pr-g|camiño|gr-)\b/.test(h),
    propose: 'Trail',
    reason: 'Ruta/sendero → Trail',
  },
  {
    match: (h, a) => a === 'TouristAttraction' && /\b(cova|cueva|gruta)\b/.test(h),
    propose: 'Cave',
    reason: 'Cueva → Cave',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(fervenza|cascada|salto-de-agua)\b/.test(h),
    propose: 'Waterfall',
    reason: 'Cascada/fervenza → Waterfall',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(iglesia|igrexa|ermida|ermita|capilla|capela|monasterio|mosteiro|catedral|santuario)\b/.test(h),
    propose: 'PlaceOfWorship',
    reason: 'Templo religioso → PlaceOfWorship',
  },
  {
    match: (h, a) => a === 'TouristAttraction' && /\b(museo|museu)\b/.test(h),
    propose: 'Museum',
    reason: 'Museo → Museum',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(praza|plaza|alameda)\b/.test(h),
    propose: 'Square',
    reason: 'Plaza → Square',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(parque|xardin|jardin)\b/.test(h),
    propose: 'Park',
    reason: 'Parque/jardín → Park',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' &&
      /\b(pazo|torre|castelo|castillo|muralla|dolmen|petroglifo|yacimiento|castro|mamoa)\b/.test(h),
    propose: 'LandmarksOrHistoricalBuildings',
    reason: 'Monumento histórico → LandmarksOrHistoricalBuildings',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(montana|monte|alto-de|pena|pico)\b/.test(h),
    propose: 'Mountain',
    reason: 'Montaña/monte → Mountain',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(rio|ria|embalse|lago|lagoa|fonte|fuente)\b/.test(h),
    propose: 'BodyOfWater',
    reason: 'Masa de agua → BodyOfWater',
  },
  {
    match: (h, a) =>
      a === 'TouristAttraction' && /\b(parque-natural|reserva|lic|zec|humedal|duna)\b/.test(h),
    propose: 'NaturePark',
    reason: 'Espacio natural protegido → NaturePark',
  },

  // ── Servicios de salud/emergencia/seguridad (probable CivilBuilding o TouristAttraction) ──
  {
    // ⚠ "botica" a solas pega con el restaurante "A Botica". Solo pega
    //   cuando el tipo actual no es Restaurant, y evitamos "a-botica"
    //   como único token.
    match: (h, a) =>
      /\bfarmacia\b/.test(h) ||
      (a !== 'Restaurant' && /\bbotica\b/.test(h) && !/\ba-botica\b/.test(h)),
    propose: 'Pharmacy',
    reason: 'Farmacia → Pharmacy',
  },
  {
    // No pisar PlaceOfWorship (p.ej. "Capilla del Hospital").
    match: (h, a) => a !== 'PlaceOfWorship' && /\b(hospital)\b/.test(h),
    propose: 'Hospital',
    reason: 'Hospital → Hospital',
  },
  {
    match: (h, a) =>
      a !== 'PlaceOfWorship' &&
      /\b(centro-de-salud|centro-saude|ambulatorio|consultorio-medico|cruz-roja|cruz-vermella)\b/.test(h),
    propose: 'Hospital',
    reason: 'Centro de salud/Cruz Roja → Hospital',
  },
  {
    match: (h) => /\b(policia|policía|guardia-civil|garda-civil|comisaria|comisaría|cuartel-de-la-guardia)\b/.test(h),
    propose: 'PoliceStation',
    reason: 'Policía/Guardia Civil → PoliceStation',
  },
  {
    match: (h) => /\b(proteccion-civil|protección-civil|bomberos|bombeiros|emergencias)\b/.test(h),
    propose: 'Organization',
    reason: 'Protección Civil/Bomberos → Organization (no hay FireStation)',
  },
  {
    match: (h) => /\b(biblioteca)\b/.test(h),
    propose: 'Library',
    reason: 'Biblioteca → Library',
  },
  {
    match: (h) => /\b(gasolinera|estacion-de-servicio|estación-de-servicio|repsol|cepsa|galp-)\b/.test(h),
    propose: 'GasStation',
    reason: 'Gasolinera → GasStation',
  },
  {
    match: (h) => /\b(banco-|banco |caixabank|abanca|santander|bbva|sabadell)\b/.test(h),
    propose: 'FinancialService',
    reason: 'Banco → FinancialService',
  },
  {
    match: (h) => /\b(estacion-de-autobuses|estación-de-autobuses|estacion-autobus)\b/.test(h),
    propose: 'BusStation',
    reason: 'Estación de autobuses → BusStation',
  },
  {
    match: (h) => /\b(parada-de-taxi|taxis-|parada-taxi)\b/.test(h),
    propose: 'TaxiStand',
    reason: 'Parada de taxi → TaxiStand',
  },
  {
    match: (h) => /\b(aparcamento|aparcamiento|parking|aparcadoiro)\b/.test(h),
    propose: 'ParkingFacility',
    reason: 'Aparcamiento → ParkingFacility',
  },

  // ── CivilBuilding genérico (lo que no sea puerto ni servicios) ─────
  {
    match: (h, a) =>
      a === 'CivilBuilding' &&
      /\b(iglesia|igrexa|ermida|ermita|capilla|capela|monasterio|mosteiro|catedral|santuario)\b/.test(h),
    propose: 'PlaceOfWorship',
    reason: 'Templo religioso (estaba como CivilBuilding) → PlaceOfWorship',
  },
  {
    match: (h, a) =>
      a === 'CivilBuilding' &&
      /\b(pazo|torre|castelo|castillo|muralla|dolmen|petroglifo|yacimiento|castro|mamoa|muino|muíño|hórreo|horreo|cruceiro)\b/.test(h),
    propose: 'LandmarksOrHistoricalBuildings',
    reason: 'Patrimonio civil histórico → LandmarksOrHistoricalBuildings',
  },
  {
    match: (h, a) =>
      a === 'CivilBuilding' && /\b(museo|museu)\b/.test(h),
    propose: 'Museum',
    reason: 'Museo (estaba como CivilBuilding) → Museum',
  },
  {
    match: (h, a) =>
      a === 'CivilBuilding' &&
      /\b(centro-cultural|auditorio|teatro|casa-da-cultura|casa-de-la-cultura)\b/.test(h),
    propose: 'CultureCenter',
    reason: 'Centro cultural/auditorio → CultureCenter',
  },

  // ── Deporte/actividad ──────────────────────────────────────────────
  {
    match: (h, a) =>
      a === 'SportsActivityLocation' &&
      /\b(kayak|piragua|piragüismo|piraguismo|vela|surf|paddle|windsurf|buceo|mergullo|snorkel|nautico|náutico|charter)\b/.test(h),
    propose: 'WaterActivityCenter',
    reason: 'Actividad náutica/acuática → WaterActivityCenter',
  },
];

// ─── Procesamiento ──────────────────────────────────────────────────────
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log('\n━━━ Reclasificación de recursos turísticos ━━━');
  console.log(APPLY ? 'MODO: APPLY (modificará la base de datos)' : 'MODO: DRY RUN (solo CSV)');
  console.log('');

  // 1. Catálogo tipología
  console.log('• Descargando catálogo tipologia…');
  const tipologias = await fetchAll('tipologia?select=type_code,grupo,activo');
  const tipSet = new Set(tipologias.map((t) => t.type_code));
  console.log(`  ${tipologias.length} tipologías, ${tipSet.size} type_codes`);

  // 2. Recursos
  console.log('• Descargando recursos…');
  const resources = await fetchAll(
    'recurso_turistico?select=id,slug,rdf_type,rdf_types,municipio_id,extras'
  );
  console.log(`  ${resources.length} recursos`);

  // 3. Traducciones ES del name
  console.log('• Descargando traducciones (name, es)…');
  const translations = await fetchAll(
    'traduccion?select=entidad_id,valor&entidad_tipo=eq.recurso_turistico&idioma=eq.es&campo=eq.name'
  );
  const nameById = new Map(translations.map((t) => [t.entidad_id, t.valor]));
  console.log(`  ${translations.length} nombres ES`);

  // 4. Evaluar reglas
  console.log('• Evaluando reglas…\n');
  const proposals = [];
  const stats = {
    totalRules: RULES.length,
    cambios: 0,
    sinCambio: 0,
    porRegla: new Map(),
    porPar: new Map(), // "actual → propuesto" → count
    requiereCatalogo: [],
    tagsUNE: new Map(), // tag_une → count
    sinTagUNE: 0, // recursos que quedarán review_required
  };

  for (const r of resources) {
    const name = nameById.get(r.id) || '';
    const haystack = `${norm(r.slug)} ${norm(name)}`.trim();
    const actual = r.rdf_type;

    let propuesto = actual;
    let razon = null;
    let requiere = false;

    for (const rule of RULES) {
      if (rule.match(haystack, actual)) {
        propuesto = rule.propose;
        razon = rule.reason;
        requiere = !!rule.requiereCatalogo;
        break;
      }
    }

    const cambia = propuesto !== actual;
    if (cambia) {
      stats.cambios++;
      const par = `${actual} → ${propuesto}`;
      stats.porPar.set(par, (stats.porPar.get(par) || 0) + 1);
      if (razon) stats.porRegla.set(razon, (stats.porRegla.get(razon) || 0) + 1);
    } else {
      stats.sinCambio++;
    }

    if (!tipSet.has(propuesto)) {
      stats.requiereCatalogo.push({ slug: r.slug, propuesto });
    }

    // Mapear rdf_type propuesto → tag UNE
    const tagUne = Object.prototype.hasOwnProperty.call(RDFTYPE_TO_UNE, propuesto)
      ? RDFTYPE_TO_UNE[propuesto]
      : undefined;
    const requiereRevision = tagUne === null || tagUne === undefined;
    if (tagUne) {
      stats.tagsUNE.set(tagUne, (stats.tagsUNE.get(tagUne) || 0) + 1);
    } else {
      stats.sinTagUNE++;
    }

    proposals.push({
      id: r.id,
      slug: r.slug,
      name,
      municipio_original: r.extras?.import_municipio_original ?? '',
      rdf_type_actual: actual,
      rdf_type_propuesto: propuesto,
      cambia_rdf_type: cambia ? 'SI' : 'no',
      razon_rdf: razon ?? '',
      tipologia_schema_existe: tipSet.has(propuesto) ? 'si' : 'NO',
      tag_une_propuesto: tagUne ?? '',
      requiere_revision: requiereRevision ? 'SI' : 'no',
      razon_revision: requiereRevision
        ? (tagUne === null
            ? `rdf_type ${propuesto} no encaja en las 18 tipologías UNE (servicio del territorio)`
            : `rdf_type ${propuesto} sin mapeo UNE definido — añadir al script`)
        : '',
    });
  }

  // 5. CSV
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const csvPath = join(OUT_DIR, 'reclasificacion_propuesta.csv');
  const header = Object.keys(proposals[0]).join(',');
  const body = proposals.map((p) => Object.values(p).map(csvEscape).join(',')).join('\n');
  writeFileSync(csvPath, `﻿${header}\n${body}\n`, 'utf-8');
  console.log(`• CSV escrito: ${csvPath}`);

  // 6. Resumen
  console.log('\n━━━ Resumen ━━━');
  console.log(`  [rdf_type] Cambios propuestos: ${stats.cambios} / ${resources.length}`);
  console.log(`             Sin cambio:         ${stats.sinCambio}`);
  console.log(`  [UNE]      Recursos con tag UNE: ${resources.length - stats.sinTagUNE}`);
  console.log(`             Para revisión (sin tag UNE, review_required=true): ${stats.sinTagUNE}`);
  console.log('\n  Distribución tag UNE propuesto:');
  [...stats.tagsUNE.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, n]) => console.log(`    ${n.toString().padStart(4)}  ${t}`));
  console.log('\n  Transiciones rdf_type:');
  [...stats.porPar.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([par, n]) => console.log(`    ${n.toString().padStart(4)}  ${par}`));
  console.log('\n  Reglas que dispararon:');
  [...stats.porRegla.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([r, n]) => console.log(`    ${n.toString().padStart(4)}  ${r}`));

  if (stats.requiereCatalogo.length > 0) {
    const missing = new Set(stats.requiereCatalogo.map((x) => x.propuesto));
    console.log('\n  ⚠ Tipologías propuestas que NO existen en catálogo:');
    for (const m of missing) {
      const n = stats.requiereCatalogo.filter((x) => x.propuesto === m).length;
      console.log(`    ${m} (${n} recursos) — añadir a tabla tipologia antes de --apply`);
    }
  } else {
    console.log('\n  ✅ Todas las tipologías propuestas existen en el catálogo.');
  }

  // 7. Apply
  if (!APPLY) {
    console.log('\n(DRY RUN — no se ha modificado nada. Revisa el CSV y lanza con --apply.)\n');
    return;
  }

  // ── 7a. UPDATE rdf_type en recurso_turistico ──────────────────────
  const cambiosRdf = proposals.filter(
    (p) => p.cambia_rdf_type === 'SI' && p.tipologia_schema_existe === 'si'
  );
  console.log(`\n• 7a · UPDATE rdf_type para ${cambiosRdf.length} recursos…`);
  let done = 0;
  for (const p of cambiosRdf) {
    await rest(`recurso_turistico?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ rdf_type: p.rdf_type_propuesto }),
    });
    done++;
    if (done % 50 === 0) process.stdout.write(`  ${done}/${cambiosRdf.length}\r`);
  }
  console.log(`  ✅ rdf_type aplicado: ${done}`);

  // ── 7b. INSERT resource_tags con el tag UNE ───────────────────────
  // Todos los recursos con tag UNE no-null → 1 fila cada uno.
  // Upsert con ON CONFLICT (resource_id, tag_key) vía merge-duplicates.
  const conTag = proposals.filter((p) => p.tag_une_propuesto);
  console.log(`\n• 7b · INSERT resource_tags (tag UNE) para ${conTag.length} recursos…`);
  const BATCH = 100;
  done = 0;
  for (let i = 0; i < conTag.length; i += BATCH) {
    const slice = conTag.slice(i, i + BATCH).map((p) => ({
      resource_id: p.id,
      tag_key: p.tag_une_propuesto,
      field: 'type',
      // Valor schema.org que va al export PID. Usamos el rdf_type propuesto.
      value: p.rdf_type_propuesto,
      pid_exportable: true,
      source: 'import',
    }));
    await rest('resource_tags?on_conflict=resource_id,tag_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(slice),
    });
    done += slice.length;
    process.stdout.write(`  ${done}/${conTag.length}\r`);
  }
  console.log(`  ✅ resource_tags insertadas: ${done}`);

  // ── 7c. review_required=true para los que no encajan en UNE ───────
  const paraRevision = proposals.filter((p) => p.requiere_revision === 'SI');
  console.log(`\n• 7c · marcar review_required=true a ${paraRevision.length} recursos…`);
  done = 0;
  for (let i = 0; i < paraRevision.length; i += BATCH) {
    const slice = paraRevision.slice(i, i + BATCH);
    // PATCH con filtro in.(id1,id2,…) — más eficiente que uno por uno.
    const ids = slice.map((p) => p.id).join(',');
    await rest(`recurso_turistico?id=in.(${ids})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ review_required: true }),
    });
    done += slice.length;
    process.stdout.write(`  ${done}/${paraRevision.length}\r`);
  }
  console.log(`  ✅ review_required marcado: ${done}`);

  console.log('\n━━━ Aplicación completada ━━━');
  console.log(`  rdf_type actualizado: ${cambiosRdf.length}`);
  console.log(`  resource_tags insertados: ${conTag.length}`);
  console.log(`  marcados para revisión: ${paraRevision.length}`);
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
