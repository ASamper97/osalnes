# Verificacion JSON-LD — Rich Results Google

**Proyecto**: DTI O Salnes
**Fecha**: 25 de marzo de 2026
**Metodo**: Revision de codigo fuente + validacion de estructura

---

## Paginas con JSON-LD implementado

| Pagina | Tipo JSON-LD | Campos incluidos | Estado |
|---|---|---|---|
| `/es` (Home) | `WebSite` + `TouristDestination` | SearchAction, publisher, geo, touristType | IMPLEMENTADO |
| `/es/recurso/parador-de-cambados` | `Hotel` | @id, geo, address, telephone, starRating, touristType, openingHours, dates | IMPLEMENTADO |
| `/es/recurso/restaurante-yayo-daporta` | `Restaurant` | @id, geo, address, telephone, starRating, touristType, servesCuisine | IMPLEMENTADO |
| `/es/recurso/praia-a-lanzada` | `Beach` | @id, geo, address, touristType, isAccessibleForFree | IMPLEMENTADO |
| `/es/recurso/festa-do-albarino` | `Festival` | @id, geo, address, touristType, openingHours | IMPLEMENTADO |
| Todas las `/recurso/*` | `BreadcrumbList` | 3 niveles: Inicio > Directorio > Recurso | IMPLEMENTADO |

---

## Mapeo de tipos UNE 178503 -> schema.org

| rdfType (BD) | schema.org (@type) | Rich Result Google |
|---|---|---|
| Hotel | Hotel | Hotel, LodgingBusiness |
| BedAndBreakfast | BedAndBreakfast | LodgingBusiness |
| Campground | Campground | LodgingBusiness |
| Restaurant | Restaurant | Restaurant |
| BarOrPub | BarOrPub | Restaurant |
| CafeOrCoffeeShop | CafeOrCoffeeShop | Restaurant |
| Winery | Winery | LocalBusiness |
| TouristAttraction | TouristAttraction | — |
| Beach | Beach | — |
| Museum | Museum | Museum |
| Park | Park | — |
| LandmarksOrHistoricalBuildings | LandmarksOrHistoricalBuildings | — |
| Festival | Festival | Event |
| Event | Event | Event |
| ViewPoint | Place | — |

---

## Campos schema.org por tipo de recurso

### Alojamiento (Hotel, Campground, etc.)
- `@type`, `@id`, `name`, `description`, `url`, `identifier`
- `geo` (GeoCoordinates), `address` (PostalAddress)
- `telephone`, `email`, `sameAs`
- `starRating` (Rating con ratingValue)
- `touristType`, `openingHours`
- `isAccessibleForFree`, `publicAccess`
- `datePublished`, `dateModified`

### Restauracion (Restaurant, BarOrPub, etc.)
- Mismos campos base +
- `servesCuisine` (array de tipos de cocina)
- `starRating` (estrellas Michelin / tenedores)

### Atracciones (Beach, Museum, etc.)
- Mismos campos base +
- `touristType` (tipos de turismo UNE 178503)
- `maximumAttendeeCapacity` (aforo)

### Eventos (Festival, Event, etc.)
- Mismos campos base +
- `openingHours` (fechas del evento)

---

## Implementacion tecnica

| Archivo | Funcion | Descripcion |
|---|---|---|
| `packages/web/src/lib/jsonld.ts` | `resourceJsonLd()` | JSON-LD de recurso con 50+ tipos schema.org mapeados |
| `packages/web/src/lib/jsonld.ts` | `websiteJsonLd()` | WebSite con SearchAction |
| `packages/web/src/lib/jsonld.ts` | `destinationJsonLd()` | TouristDestination de O Salnes |
| `packages/web/src/lib/jsonld.ts` | `breadcrumbJsonLd()` | BreadcrumbList de 3 niveles |
| `packages/web/src/app/[lang]/recurso/[slug]/page.tsx` | Server Component | 2 bloques `<script type="application/ld+json">` |
| `packages/web/src/app/[lang]/page.tsx` | Server Component | 2 bloques `<script type="application/ld+json">` |

---

## Verificacion con Google Rich Results Test

Para verificar en produccion:
1. Abrir https://search.google.com/test/rich-results
2. Pegar URL: `https://turismo.osalnes.gal/es/recurso/parador-de-cambados`
3. Verificar que detecta: Hotel, GeoCoordinates, PostalAddress, Rating
4. Repetir con un restaurante y una playa

**Nota**: Requiere que la web este desplegada en produccion con acceso publico.
