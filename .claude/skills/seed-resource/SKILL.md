---
name: seed-resource
description: Generate SQL seed data for tourist resources. Creates realistic resources with translations and correct FK references.
argument-hint: [description, e.g. "5 restaurants in O Grove" or "3 beaches in Sanxenxo"]
disable-model-invocation: true
---

Generate SQL seed for: "$ARGUMENTS"

## Template

Follow the pattern in `database/seeds/006_recursos_demo.sql`:

1. INSERT into `recurso_turistico` joining with `municipio` by `codigo_ine`
2. INSERT translations (ES name, GL name, ES description) via `traduccion` table
3. All resources set to `estado_editorial = 'publicado'`, `visible_en_mapa = true`
4. Use `ON CONFLICT (slug) DO NOTHING` to be idempotent

## Municipality codes
- Cambados: 36008
- O Grove: 36020
- A Illa de Arousa: 36026
- Meano: 36029
- Meis: 36034
- Ribadumia: 36046
- Sanxenxo: 36051
- Vilagarcia de Arousa: 36060
- Vilanova de Arousa: 36062

## Resource types (rdf_type)
- Beaches: Beach
- Hotels: Hotel, RuralHouse, Campground, BedAndBreakfast
- Restaurants: Restaurant, BarOrPub, CafeOrCoffeeShop, Winery
- Attractions: TouristAttraction, Museum, ViewPoint, LandmarksOrHistoricalBuildings
- Events: Festival, Event, FoodEvent, MusicEvent

## Rules
- Use REAL place names and coordinates from O Salnes
- Slugs: lowercase, hyphens only
- Phone format: Spanish without +34 prefix (e.g., '986 720 075')
- Include tourist_types from UNE 178503 (BEACH AND SUN TOURISM, FOOD TOURISM, etc.)
- Descriptions should be 2-3 sentences, factual
