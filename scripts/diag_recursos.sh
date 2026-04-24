#!/usr/bin/env bash
# Diagnóstico read-only del estado de clasificación y conexión de recursos.
# Solo SELECTs; nunca muta nada.
set -euo pipefail

# Cargar env con espacios en el path
while IFS='=' read -r k v; do
  [[ -z "$k" || "$k" =~ ^# ]] && continue
  export "$k=$v"
done < <(grep -E '^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=' .env)

H=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

q() {
  local label="$1"; shift
  local url="$1"; shift
  echo "── $label"
  curl -s "${H[@]}" "$url" "$@"
  echo
}

count() {
  local label="$1"; shift
  local path="$1"; shift
  echo "── $label"
  curl -s "${H[@]}" -H "Prefer: count=exact" -H "Range: 0-0" -i "$SUPABASE_URL/rest/v1/$path" 2>&1 \
    | grep -i '^content-range' | awk -F'/' '{print "  total:",$2}'
}

echo "=============================="
echo " Totales"
echo "=============================="
count "recurso_turistico (total)" "recurso_turistico?select=id"
count "  con municipio_id"         "recurso_turistico?select=id&municipio_id=not.is.null"
count "  sin municipio_id"         "recurso_turistico?select=id&municipio_id=is.null"
count "  con zona_id"              "recurso_turistico?select=id&zona_id=not.is.null"
count "  sin zona_id"              "recurso_turistico?select=id&zona_id=is.null"
count "  con rdf_type"             "recurso_turistico?select=id&rdf_type=not.is.null"
count "  sin rdf_type"             "recurso_turistico?select=id&rdf_type=is.null"
count "  con lat+lng"              "recurso_turistico?select=id&latitude=not.is.null&longitude=not.is.null"
count "  visibles en mapa"         "recurso_turistico?select=id&visible_en_mapa=eq.true"
count "  publicados"               "recurso_turistico?select=id&estado_editorial=eq.publicado"
count "  borradores"               "recurso_turistico?select=id&estado_editorial=eq.borrador"

echo
echo "=============================="
echo " Traducciones"
echo "=============================="
count "traduccion total (todas entidades)"                          "traduccion?select=id"
count "traduccion entidad_tipo=recurso_turistico"                   "traduccion?select=id&entidad_tipo=eq.recurso_turistico"
count "  idioma=es"                                                 "traduccion?select=id&entidad_tipo=eq.recurso_turistico&idioma=eq.es"
count "  idioma=gl"                                                 "traduccion?select=id&entidad_tipo=eq.recurso_turistico&idioma=eq.gl"
count "  campo=name es"                                             "traduccion?select=id&entidad_tipo=eq.recurso_turistico&idioma=eq.es&campo=eq.name"
count "  campo=name gl"                                             "traduccion?select=id&entidad_tipo=eq.recurso_turistico&idioma=eq.gl&campo=eq.name"
count "  campo=description es"                                      "traduccion?select=id&entidad_tipo=eq.recurso_turistico&idioma=eq.es&campo=eq.description"

echo
echo "=============================="
echo " Asociaciones M:N"
echo "=============================="
count "recurso_categoria total"   "recurso_categoria?select=recurso_id"
count "recurso_producto total"    "recurso_producto?select=recurso_id"
count "relacion_recurso total"    "relacion_recurso?select=id"
count "asset_multimedia (recurso)"  "asset_multimedia?select=id&entidad_tipo=eq.recurso_turistico"

echo
echo "=============================="
echo " Distribución por rdf_type (top 30)"
echo "=============================="
curl -s "${H[@]}" "$SUPABASE_URL/rest/v1/recurso_turistico?select=rdf_type&limit=2000"  | python -c "
import json,sys,collections
rows=json.load(sys.stdin)
c=collections.Counter([r.get('rdf_type') for r in rows])
for k,v in c.most_common(30):
    print(f'  {str(k):40s} {v}')
print(f'  ---- total rdf_type distintos: {len(c)} / filas leídas: {len(rows)}')
"

echo
echo "=============================="
echo " Distribución por municipio (top 20)"
echo "=============================="
curl -s "${H[@]}" "$SUPABASE_URL/rest/v1/recurso_turistico?select=municipio_id&limit=2000" | python -c "
import json,sys,collections
rows=json.load(sys.stdin)
c=collections.Counter([r.get('municipio_id') for r in rows])
for k,v in c.most_common(20):
    print(f'  {str(k):40s} {v}')
"

echo
echo "=============================="
echo " Muestras de recursos SIN clasificar"
echo "=============================="
echo "── Sin rdf_type (primeros 5)"
curl -s "${H[@]}" "$SUPABASE_URL/rest/v1/recurso_turistico?select=id,slug,uri,rdf_type,rdf_types,municipio_id&rdf_type=is.null&limit=5"
echo
echo "── Sin municipio_id (primeros 5)"
curl -s "${H[@]}" "$SUPABASE_URL/rest/v1/recurso_turistico?select=id,slug,uri,rdf_type,municipio_id&municipio_id=is.null&limit=5"
echo
echo "── Sin NINGUNA traducción de name (primeros 5)"
curl -s "${H[@]}" "$SUPABASE_URL/rest/v1/rpc/_dummy" -o /dev/null  # noop placeholder
