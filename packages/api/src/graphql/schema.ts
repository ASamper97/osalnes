import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';
import { supabase } from '../db/supabase.js';
import { getTranslations } from '../services/translation.service.js';

// ---------------------------------------------------------------------------
// Types — compatible with PID SEGITTUR schema
// ---------------------------------------------------------------------------

const LocalizedValueType = new GraphQLObjectType({
  name: 'LocalizedValue',
  fields: {
    value: { type: GraphQLString },
    language: { type: GraphQLString },
  },
});

const LocationType = new GraphQLObjectType({
  name: 'Location',
  fields: {
    latitude: { type: GraphQLFloat },
    longitude: { type: GraphQLFloat },
    streetAddress: { type: GraphQLString },
    postalCode: { type: GraphQLString },
    addressLocality: { type: GraphQLString },
    addressRegion: { type: GraphQLString },
    addressCountry: { type: GraphQLString },
  },
});

const ContactType = new GraphQLObjectType({
  name: 'Contact',
  fields: {
    telephone: { type: new GraphQLList(GraphQLString) },
    email: { type: new GraphQLList(GraphQLString) },
    url: { type: GraphQLString },
  },
});

const MediaType = new GraphQLObjectType({
  name: 'Media',
  fields: {
    type: { type: GraphQLString },
    url: { type: GraphQLString },
    alt: { type: GraphQLString },
  },
});

const PlaceType = new GraphQLObjectType({
  name: 'Place',
  fields: {
    uri: { type: new GraphQLNonNull(GraphQLString) },
    rdfType: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLList(LocalizedValueType) },
    description: { type: new GraphQLList(LocalizedValueType) },
    contact: { type: ContactType },
    location: { type: LocationType },
    multimedia: { type: new GraphQLList(MediaType) },
  },
});

// ---------------------------------------------------------------------------
// Helper: map Supabase rows to PID-compatible Place objects
// ---------------------------------------------------------------------------

async function mapRowToPlace(row: Record<string, any>, lang?: string | null) {
  const translations = await getTranslations('recurso_turistico', row.id);
  const tipologia = row.tipologia as Record<string, string> | null;

  const nameValues = translations.name || {};
  const descValues = translations.description || {};

  const nameList = Object.entries(nameValues)
    .filter(([l]) => !lang || l === lang)
    .map(([language, value]) => ({ value, language }));

  const descList = Object.entries(descValues)
    .filter(([l]) => !lang || l === lang)
    .map(([language, value]) => ({ value, language }));

  return {
    uri: row.uri,
    rdfType: tipologia?.type_code || 'Place',
    name: nameList,
    description: descList,
    contact: {
      telephone: row.telefono || [],
      email: row.email || [],
      url: row.web,
    },
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      streetAddress: row.direccion,
      postalCode: row.codigo_postal,
      addressLocality: row.municipio?.slug || null,
      addressRegion: 'Pontevedra',
      addressCountry: 'ES',
    },
    multimedia: [],
  };
}

// ---------------------------------------------------------------------------
// Generic filter resolver via Supabase
// ---------------------------------------------------------------------------

async function resolvePlaces(
  _dti: string,
  lang: string | null | undefined,
  typeFilter?: string | null,
) {
  let query = supabase
    .from('recurso_turistico')
    .select(`
      id, uri, latitude, longitude, direccion, codigo_postal,
      telefono, email, web,
      tipologia:tipo_id ( type_code, schema_org_type ),
      municipio:municipio_id ( slug )
    `)
    .eq('estado', 'publicado');

  if (typeFilter) {
    query = query.eq('tipologia.type_code', typeFilter);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) throw error;

  return Promise.all((data || []).map((row) => mapRowToPlace(row, lang)));
}

// ---------------------------------------------------------------------------
// Root Query — compatible PID SEGITTUR pattern
// ---------------------------------------------------------------------------

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    placesByFilter: {
      type: new GraphQLList(PlaceType),
      args: {
        dti: { type: new GraphQLNonNull(GraphQLString) },
        lang: { type: GraphQLString },
        type: { type: GraphQLString },
      },
      resolve: (_root, args) => resolvePlaces(args.dti, args.lang, args.type),
    },
    hotelsByFilter: {
      type: new GraphQLList(PlaceType),
      args: {
        dti: { type: new GraphQLNonNull(GraphQLString) },
        lang: { type: GraphQLString },
      },
      resolve: (_root, args) => resolvePlaces(args.dti, args.lang, 'Hotel'),
    },
    beachesByFilter: {
      type: new GraphQLList(PlaceType),
      args: {
        dti: { type: new GraphQLNonNull(GraphQLString) },
        lang: { type: GraphQLString },
      },
      resolve: (_root, args) => resolvePlaces(args.dti, args.lang, 'Beach'),
    },
    restaurantsByFilter: {
      type: new GraphQLList(PlaceType),
      args: {
        dti: { type: new GraphQLNonNull(GraphQLString) },
        lang: { type: GraphQLString },
      },
      resolve: (_root, args) => resolvePlaces(args.dti, args.lang, 'Restaurant'),
    },
    eventsByFilter: {
      type: new GraphQLList(PlaceType),
      args: {
        dti: { type: new GraphQLNonNull(GraphQLString) },
        lang: { type: GraphQLString },
      },
      resolve: (_root, args) => resolvePlaces(args.dti, args.lang, 'Event'),
    },
    historicalorculturalresourcesByFilter: {
      type: new GraphQLList(PlaceType),
      args: {
        dti: { type: new GraphQLNonNull(GraphQLString) },
        lang: { type: GraphQLString },
        subclass: { type: GraphQLString },
      },
      resolve: (_root, args) =>
        resolvePlaces(args.dti, args.lang, args.subclass || 'LandmarksOrHistoricalBuildings'),
    },
  },
});

export const schema = new GraphQLSchema({
  query: QueryType,
});
