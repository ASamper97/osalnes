/**
 * Tipos de turismo segun UNE 178503 seccion 7.6 (atributo touristType)
 */

export const TOURIST_TYPES_BY_CATEGORY = {
  traveler: [
    'FAMILY TOURISM',
    'LGTBI TOURISM',
    'BACKPACKING TOURISM',
    'WOMEN TOURISM',
    'BUSINESS TOURISM',
    'ROMANTIC TOURISM',
    'SENIOR TOURISM',
    'SINGLES TOURISM',
  ],
  activity: [
    'ADVENTURE TOURISM',
    'WELLNESS TOURISM',
    'CYCLING TOURISM',
    'DIVING TOURISM',
    'FISHING TOURISM',
    'SAILING TOURISM',
    'SHOPPING TOURISM',
    'SPORTS TOURISM',
    'TREKKING TOURISM',
    'WATER SPORTS TOURISM',
    'WINTER SPORTS TOURISM',
  ],
  motivation: [
    'BEACH AND SUN TOURISM',
    'CULTURAL TOURISM',
    'ECOTOURISM',
    'HERITAGE TOURISM',
    'NATURE TOURISM',
    'RELIGIOUS TOURISM',
    'RURAL TOURISM',
    'URBAN TOURISM',
    'BIRDWATCHING',
    'PHOTOGRAPHY TOURISM',
    'EVENTS AND FESTIVALS TOURISM',
    'SHORT BREAK TOURISM',
    'CRUISE TOURISM',
  ],
  product: [
    'FOOD TOURISM',
    'WINE TOURISM',
    'BEER TOURISM',
    'OLIVE OIL TOURISM',
  ],
} as const;

/** Lista plana de todos los touristType */
export const TOURIST_TYPES = [
  ...TOURIST_TYPES_BY_CATEGORY.traveler,
  ...TOURIST_TYPES_BY_CATEGORY.activity,
  ...TOURIST_TYPES_BY_CATEGORY.motivation,
  ...TOURIST_TYPES_BY_CATEGORY.product,
] as const;

export type TouristType = typeof TOURIST_TYPES[number];
