import type { Resource } from './api-client';
import type { Locale } from '@/i18n/config';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://turismo.osalnes.gal';

/** Map UNE 178503 rdfType to schema.org type */
const SCHEMA_ORG_MAP: Record<string, string> = {
  Hotel: 'Hotel',
  RuralHouse: 'House',
  BedAndBreakfast: 'BedAndBreakfast',
  Campground: 'Campground',
  Apartment: 'Apartment',
  Hostel: 'Hostel',
  ApartHotel: 'LodgingBusiness',
  GuestHouse: 'LodgingBusiness',
  RuralHotel: 'LodgingBusiness',
  LodgingBusiness: 'LodgingBusiness',
  Restaurant: 'Restaurant',
  BarOrPub: 'BarOrPub',
  CafeOrCoffeeShop: 'CafeOrCoffeeShop',
  Winery: 'Winery',
  Brewery: 'Brewery',
  IceCreamShop: 'FoodEstablishment',
  TouristAttraction: 'TouristAttraction',
  Beach: 'Beach',
  Museum: 'Museum',
  Park: 'Park',
  NaturePark: 'Park',
  ViewPoint: 'Place',
  PlaceOfWorship: 'PlaceOfWorship',
  LandmarksOrHistoricalBuildings: 'LandmarksOrHistoricalBuildings',
  Monument: 'LandmarksOrHistoricalBuildings',
  Trail: 'TouristAttraction',
  Cave: 'TouristAttraction',
  ArtGallery: 'ArtGallery',
  Library: 'Library',
  GolfCourse: 'GolfCourse',
  YachtingPort: 'BoatTerminal',
  Zoo: 'Zoo',
  Aquarium: 'Aquarium',
  Event: 'Event',
  Festival: 'Festival',
  MusicEvent: 'MusicEvent',
  SportsEvent: 'SportsEvent',
  FoodEvent: 'FoodEvent',
  Fair: 'Event',
  BusStation: 'BusStation',
  Port: 'BoatTerminal',
  TrainStation: 'TrainStation',
  ParkingFacility: 'ParkingFacility',
  TouristInformationCenter: 'TouristInformationCenter',
  Hospital: 'Hospital',
  Pharmacy: 'Pharmacy',
  GasStation: 'GasStation',
  TouristDestination: 'TouristDestination',
};

/**
 * Generate JSON-LD structured data for a tourist resource.
 * Alineado con UNE 178503 + schema.org para Google Rich Results.
 */
export function resourceJsonLd(resource: Resource, lang: Locale) {
  const name = resource.name[lang] || resource.name.es || resource.name.gl || '';
  const description = resource.description[lang] || resource.description.es || '';
  const schemaType = SCHEMA_ORG_MAP[resource.rdfType] || 'TouristAttraction';

  // deno-lint-ignore no-explicit-any
  const ld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': `${BASE_URL}/${lang}/recurso/${resource.slug}`,
    name,
    description: description.slice(0, 300),
    url: `${BASE_URL}/${lang}/recurso/${resource.slug}`,
    identifier: resource.uri,
    inLanguage: lang,
  };

  // Location
  if (resource.location?.latitude && resource.location?.longitude) {
    ld.geo = {
      '@type': 'GeoCoordinates',
      latitude: Number(resource.location.latitude),
      longitude: Number(resource.location.longitude),
    };
  }

  if (resource.location?.streetAddress) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: resource.location.streetAddress,
      ...(resource.location.postalCode && { postalCode: resource.location.postalCode }),
      addressRegion: 'Pontevedra',
      addressCountry: 'ES',
    };
  }

  // Contact
  if (resource.contact?.telephone?.length) {
    ld.telephone = resource.contact.telephone.length === 1
      ? resource.contact.telephone[0]
      : resource.contact.telephone;
  }
  if (resource.contact?.email?.length) {
    ld.email = resource.contact.email[0];
  }
  if (resource.contact?.url) {
    ld.sameAs = resource.contact.url;
  }

  // Rating (UNE 178503 sec. 7.7)
  if (resource.ratingValue) {
    ld.starRating = {
      '@type': 'Rating',
      ratingValue: resource.ratingValue,
      bestRating: 5,
    };
  }

  // Tourist types (UNE 178503 sec. 7.6)
  if (resource.touristTypes?.length) {
    ld.touristType = resource.touristTypes;
  }

  // Cuisine (restaurants)
  if (resource.servesCuisine?.length) {
    ld.servesCuisine = resource.servesCuisine;
  }

  // Opening hours
  if (resource.openingHours) {
    ld.openingHours = resource.openingHours;
  }

  // Accessibility
  if (resource.isAccessibleForFree !== null && resource.isAccessibleForFree !== undefined) {
    ld.isAccessibleForFree = resource.isAccessibleForFree;
  }
  if (resource.publicAccess !== null && resource.publicAccess !== undefined) {
    ld.publicAccess = resource.publicAccess;
  }

  // Capacity
  if (resource.occupancy) {
    ld.maximumAttendeeCapacity = resource.occupancy;
  }

  // Dates
  if (resource.publishedAt) ld.datePublished = resource.publishedAt;
  if (resource.updatedAt) ld.dateModified = resource.updatedAt;

  return ld;
}

/**
 * WebSite + TouristDestination structured data for the homepage.
 */
export function websiteJsonLd(lang: Locale, siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: `${BASE_URL}/${lang}`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/${lang}/buscar?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Mancomunidad de O Salnés',
      url: BASE_URL,
    },
  };
}

/**
 * TouristDestination JSON-LD for the homepage.
 */
export function destinationJsonLd(lang: Locale, siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    '@id': `${BASE_URL}/${lang}`,
    name: 'O Salnés',
    description: lang === 'gl'
      ? 'Destino turistico intelixente na Ria de Arousa, Galicia. 8 municipios, praias, gastronomia e patrimonio.'
      : 'Destino turistico inteligente en la Ria de Arousa, Galicia. 8 municipios, playas, gastronomia y patrimonio.',
    url: `${BASE_URL}/${lang}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 42.50,
      longitude: -8.85,
    },
    address: {
      '@type': 'PostalAddress',
      addressRegion: 'Pontevedra',
      addressCountry: 'ES',
    },
    touristType: ['Cultural', 'Beach and sun', 'Gastronomy', 'Nature', 'Wine tourism'],
    isPartOf: {
      '@type': 'AdministrativeArea',
      name: 'Rias Baixas',
    },
  };
}

/**
 * BreadcrumbList structured data.
 */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
