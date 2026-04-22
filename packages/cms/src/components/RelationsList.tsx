/**
 * RelationsList — lista de relaciones agrupadas por predicado
 *
 * Separa "outgoing" (creadas por el usuario) de "incoming" (mirrors
 * automáticos). Cada relación muestra el recurso destino con chips de
 * contexto y botón eliminar.
 *
 * Decisión 8-C: lista agrupada simple, sin grafo visual.
 */

import { groupRelations, type ResourceRelation } from '@osalnes/shared/data/resource-relations';
import { STEP8_COPY } from '../pages/step8-relations.copy';

const COPY = STEP8_COPY.list;

export interface RelationsListProps {
  relations: ResourceRelation[];
  loading: boolean;
  onDelete: (id: string) => void;
  onVisitTarget: (id: string) => void;
}

export default function RelationsList({
  relations,
  loading,
  onDelete,
  onVisitTarget,
}: RelationsListProps) {
  if (loading && relations.length === 0) {
    return (
      <div className="relations-list-loading">
        <div className="relations-skeleton-row" />
        <div className="relations-skeleton-row" />
      </div>
    );
  }

  if (relations.length === 0) {
    return (
      <div className="relations-list-empty">
        <strong>{COPY.emptyTitle}</strong>
        <p className="muted">{COPY.emptyHint}</p>
      </div>
    );
  }

  const groups = groupRelations(relations);

  return (
    <div className="relations-list">
      {groups.map((group, i) => (
        <section
          key={`${group.predicate}-${group.isMirrorGroup ? 'in' : 'out'}-${i}`}
          className={`relations-group ${group.isMirrorGroup ? 'is-mirror-group' : ''}`}
        >
          <h3 className="relations-group-title">
            <span aria-hidden>{group.meta.icon}</span>
            {group.isMirrorGroup ? group.meta.uiPhraseInverse : `${capitalize(group.meta.uiPhrase)}:`}
            {group.isMirrorGroup && (
              <span
                className="relations-group-mirror-label"
                title={COPY.mirrorTooltip}
              >
                {COPY.mirrorLabel}
              </span>
            )}
          </h3>

          <ul className="relations-group-list" role="list">
            {group.relations.map((rel) => (
              <RelationCard
                key={rel.id}
                relation={rel}
                isMirror={group.isMirrorGroup}
                onDelete={() => onDelete(rel.id)}
                onVisitTarget={() => onVisitTarget(rel.targetId)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface RelationCardProps {
  relation: ResourceRelation;
  isMirror: boolean;
  onDelete: () => void;
  onVisitTarget: () => void;
}

function RelationCard({ relation, isMirror, onDelete, onVisitTarget }: RelationCardProps) {
  return (
    <li className="relation-card">
      <button
        type="button"
        className="relation-card-body"
        onClick={onVisitTarget}
        aria-label={`Abrir ${relation.targetName}`}
      >
        <div className="relation-card-main">
          <div className="relation-card-name">{relation.targetName}</div>
          <div className="relation-card-meta muted">
            {relation.targetType && <span>{relation.targetType}</span>}
            {relation.targetMunicipality && (
              <>
                <span className="muted">·</span>
                <span>{relation.targetMunicipality}</span>
              </>
            )}
            <span className="muted">·</span>
            <StatusChip status={relation.targetStatus} />
          </div>
          {relation.note && (
            <div className="relation-card-note muted">“{relation.note}”</div>
          )}
        </div>
      </button>

      {/* Los mirrors no se pueden borrar — hay que ir al recurso origen */}
      {!isMirror && (
        <button
          type="button"
          className="relation-card-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={COPY.deleteTooltip}
          aria-label={`Eliminar relación con ${relation.targetName}`}
        >
          ×
        </button>
      )}
    </li>
  );
}

function StatusChip({ status }: { status: string }) {
  const label = STEP8_COPY.statusLabels[status] ?? status;
  return <span className={`relation-status-chip relation-status-${status}`}>{label}</span>;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
