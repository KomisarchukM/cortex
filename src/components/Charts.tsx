import { useLanguage } from '../i18n';
import type { Metrics } from '../../shared/model';
import { modules } from '../../shared/modules';
export function Radar({ metrics: m }: { metrics: Metrics }) {
  const { t } = useLanguage();

  const ids = ['reaction', 'working-memory', 'logic', 'attention', 'spatial', 'precision'];
  const point = (i: number, v: number) => {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    return `${160 + Math.cos(a) * 105 * v},${145 + Math.sin(a) * 105 * v}`;
  };
  return (
    <div className="radar">
      <svg
        viewBox="0 0 320 300"
        role="img"
        aria-label={t('Six dimension performance radar; values are listed below')}
      >
        {[0.25, 0.5, 0.75, 1].map((v) => (
          <polygon
            key={v}
            points={ids.map((_, i) => point(i, v)).join(' ')}
            fill="none"
            stroke="var(--border)"
          />
        ))}
        {ids.map((_, i) => (
          <line
            key={i}
            x1="160"
            y1="145"
            x2={point(i, 1).split(',')[0]}
            y2={point(i, 1).split(',')[1]}
            stroke="var(--border)"
          />
        ))}
        <polygon
          points={ids.map((id, i) => point(i, (m.categories[id] || 0) / 100)).join(' ')}
          fill="var(--accent)"
          fillOpacity=".12"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        {['Response', 'Memory', 'Reasoning', 'Attention', 'Spatial', 'Precision'].map(
          (label, i) => {
            const [x, y] = point(i, 1.23).split(',');
            return (
              <text key={label} x={x} y={y} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {t(label)}
              </text>
            );
          },
        )}
      </svg>
      <div className="chart-legend">
        <span className="legend-swatch" /> {t(' Session performance')}{' '}
        <span className="muted">{t('Scale 0–100')}</span>
      </div>
    </div>
  );
}
export function Timeline({
  metrics: m,
  field = 'accuracy',
}: {
  metrics: Metrics;
  field?: 'accuracy' | 'confidence' | 'latency';
}) {
  const { t } = useLanguage();

  const data = m.timeline;
  const max = field === 'latency' ? Math.max(1, ...data.map((d) => d.latency)) : 100;
  const points = data
    .map(
      (d, i) => `${35 + (i / Math.max(1, data.length - 1)) * 530},${150 - (d[field] / max) * 125}`,
    )
    .join(' ');
  return (
    <div className="timeline-chart">
      {!data.length ? (
        <p className="muted">{t('No completed trials yet.')}</p>
      ) : (
        <svg
          viewBox="0 0 600 190"
          role="img"
          aria-label={t(
            `${field} by trial block, from ${data[0][field]} to ${data.at(-1)![field]}`,
          )}
        >
          <text x="0" y="25" fontSize="10" fill="var(--muted)">
            {Math.round(max)}
            {field === 'latency' ? t('ms') : t('%')}
          </text>
          <text x="12" y="151" fontSize="10" fill="var(--muted)">
            0
          </text>
          {[25, 87, 150].map((y) => (
            <line
              key={y}
              x1="35"
              x2="570"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="3 4"
            />
          ))}
          <polyline points={points} stroke="var(--accent)" strokeWidth="2" fill="none" />
          {data.map((d, i) => (
            <circle
              key={i}
              cx={35 + (i / Math.max(1, data.length - 1)) * 530}
              cy={150 - (d[field] / max) * 125}
              r="3"
              fill="var(--accent)"
            >
              <title>
                {t('Trial ')}
                {d.trial}: {d[field]}
                {field === 'latency' ? t(' ms') : t('%')}
              </title>
            </circle>
          ))}
          <text x="35" y="180" fontSize="10" fill="var(--muted)">
            {t('Trial 1')}
          </text>
          <text x="560" y="180" textAnchor="end" fontSize="10" fill="var(--muted)">
            {t('Trial ')}
            {data.at(-1)!.trial}
          </text>
        </svg>
      )}
    </div>
  );
}
export function Distribution({ values }: { values: number[] }) {
  const { t } = useLanguage();

  const bounds = [200, 350, 500, 750, 1500, 3500];
  const bins = bounds.map(
    (b, i) => values.filter((v) => v > (bounds[i - 1] || 0) && v <= b).length,
  );
  const max = Math.max(1, ...bins);
  return (
    <div className="distribution">
      <div className="histogram">
        {bins.map((n, i) => (
          <div key={i}>
            <span style={{ height: `${(n / max) * 100}%` }}>
              <b>{n}</b>
            </span>
            <small>{bounds[i]}</small>
          </div>
        ))}
      </div>
      <div className="chart-legend">{t('Response time (ms) · Trial counts')}</div>
      {!values.length && (
        <p className="small muted">{t('No successful reaction trials recorded.')}</p>
      )}
    </div>
  );
}
export function CategoryBars({ metrics: m }: { metrics: Metrics }) {
  const { t } = useLanguage();

  return (
    <div className="category-bars">
      {modules.map((module) => (
        <div key={module.id}>
          <div>
            <span>{t(module.name)}</span>
            <b className="mono">{m.categories[module.id] ?? 0}</b>
          </div>
          <div className="bar-track">
            <span style={{ width: `${m.categories[module.id] || 0}%` }} />
          </div>
          {(m.labels[module.id] || (module.id === 'working-memory' && m.labels.memory)) && (
            <p className="small muted">{m.labels[module.id] || m.labels.memory}</p>
          )}
        </div>
      ))}
    </div>
  );
}
