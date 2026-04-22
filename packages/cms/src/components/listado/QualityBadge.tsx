/**
 * QualityBadge — círculo con nota 0-100 coloreada por tramo (decisión 2-B)
 */

export default function QualityBadge({
  score,
  pidMissing,
}: {
  score: number;
  pidMissing: number;
}) {
  const band = score < 50 ? 'low' : score < 80 ? 'mid' : 'high';
  const title = pidMissing > 0
    ? `Calidad ${score}/100 · ${pidMissing} campo${pidMissing === 1 ? '' : 's'} obligatorio${pidMissing === 1 ? '' : 's'} sin rellenar`
    : `Calidad ${score}/100`;

  return (
    <div className={`list-quality-badge list-quality-badge-${band}`} title={title}>
      <span className="list-quality-score">{score}</span>
      {pidMissing > 0 && (
        <span className="list-quality-alert" aria-label="Incompleto">!</span>
      )}
    </div>
  );
}
