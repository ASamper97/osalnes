/**
 * Tipos de recurso turistico segun UNE 178503 seccion 7.5
 * Subconjunto priorizado para O Salnes
 */

// --- Alojamientos ---
export const ACCOMMODATION_TYPES = {
  Hotel: 'Hotel',
  RuralHouse: 'RuralHouse',
  BedAndBreakfast: 'BedAndBreakfast',
  Campground: 'Campground',
  Apartment: 'Apartment',
  Hostel: 'Hostel',
  ApartHotel: 'ApartHotel',
  GuestHouse: 'GuestHouse',
  RuralHotel: 'RuralHotel',
  LodgingBusiness: 'LodgingBusiness',
} as const;

// --- Restauracion ---
export const FOOD_TYPES = {
  Restaurant: 'Restaurant',
  BarOrPub: 'BarOrPub',
  CafeOrCoffeeShop: 'CafeOrCoffeeShop',
  Winery: 'Winery',
  Brewery: 'Brewery',
  IceCreamShop: 'IceCreamShop',
} as const;

// --- Recursos turisticos y ocio ---
export const ATTRACTION_TYPES = {
  TouristAttraction: 'TouristAttraction',
  Beach: 'Beach',
  PlaceOfWorship: 'PlaceOfWorship',
  CivilBuilding: 'CivilBuilding',
  MilitaryBuilding: 'MilitaryBuilding',
  Museum: 'Museum',
  Park: 'Park',
  NaturePark: 'NaturePark',
  ViewPoint: 'ViewPoint',
  LandmarksOrHistoricalBuildings: 'LandmarksOrHistoricalBuildings',
  BodyOfWater: 'BodyOfWater',
  Mountain: 'Mountain',
  Trail: 'Trail',
  Square: 'Square',
  Street: 'Street',
  District: 'District',
  Cave: 'Cave',
  Waterfall: 'Waterfall',
  SportsActivityLocation: 'SportsActivityLocation',
  ShoppingCenter: 'ShoppingCenter',
  AmusementPark: 'AmusementPark',
  ArtGallery: 'ArtGallery',
  Library: 'Library',
  CultureCenter: 'CultureCenter',
  Cemetery: 'Cemetery',
  GolfCourse: 'GolfCourse',
  WaterActivityCenter: 'WaterActivityCenter',
  YachtingPort: 'YachtingPort',
  Zoo: 'Zoo',
  Aquarium: 'Aquarium',
} as const;

// --- Eventos ---
export const EVENT_TYPES = {
  Event: 'Event',
  Festival: 'Festival',
  TraditionalFestival: 'TraditionalFestival',
  FoodEvent: 'FoodEvent',
  MusicEvent: 'MusicEvent',
  SportsEvent: 'SportsEvent',
  ExhibitionEvent: 'ExhibitionEvent',
  BusinessEvent: 'BusinessEvent',
  Fair: 'Fair',
} as const;

// --- Transporte ---
export const TRANSPORT_TYPES = {
  BusStation: 'BusStation',
  BusStop: 'BusStop',
  Port: 'Port',
  TaxiStand: 'TaxiStand',
  ParkingFacility: 'ParkingFacility',
  TrainStation: 'TrainStation',
} as const;

// --- Informacion y servicios ---
export const SERVICE_TYPES = {
  TouristInformationCenter: 'TouristInformationCenter',
  TravelAgency: 'TravelAgency',
  GasStation: 'GasStation',
  FinancialService: 'FinancialService',
  Hospital: 'Hospital',
  Pharmacy: 'Pharmacy',
  PoliceStation: 'PoliceStation',
} as const;

// --- General ---
export const GENERAL_TYPES = {
  TouristDestination: 'TouristDestination',
  TouristTrip: 'TouristTrip',
  Offer: 'Offer',
  Organization: 'Organization',
} as const;

/** Todos los tipos de recurso UNE 178503 (codigos schema.org) */
export const SCHEMA_ORG_RESOURCE_TYPES = {
  ...ACCOMMODATION_TYPES,
  ...FOOD_TYPES,
  ...ATTRACTION_TYPES,
  ...EVENT_TYPES,
  ...TRANSPORT_TYPES,
  ...SERVICE_TYPES,
  ...GENERAL_TYPES,
} as const;

export type ResourceType = typeof SCHEMA_ORG_RESOURCE_TYPES[keyof typeof SCHEMA_ORG_RESOURCE_TYPES];

/** Mapping type -> schema.org equivalent */
export const SCHEMA_ORG_MAP: Record<string, string> = {
  Hotel: 'Hotel',
  RuralHouse: 'House',
  BedAndBreakfast: 'BedAndBreakfast',
  Campground: 'Campground',
  Apartment: 'Apartment',
  Hostel: 'Hostel',
  Restaurant: 'Restaurant',
  BarOrPub: 'BarOrPub',
  CafeOrCoffeeShop: 'CafeOrCoffeeShop',
  Winery: 'Winery',
  TouristAttraction: 'TouristAttraction',
  Beach: 'Beach',
  PlaceOfWorship: 'PlaceOfWorship',
  Museum: 'Museum',
  Park: 'Park',
  ViewPoint: 'Place',
  LandmarksOrHistoricalBuildings: 'LandmarksOrHistoricalBuildings',
  Event: 'Event',
  Festival: 'Festival',
  MusicEvent: 'MusicEvent',
  TouristDestination: 'TouristDestination',
  TouristTrip: 'TouristTrip',
};
