import { useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import type { Metrics, Locale } from '../../shared/model';
import { modules } from '../../shared/modules';
import { api, navigate } from '../api';
import { Shell, PageHead, Badge, Icon, ErrorNote } from '../components/Chrome';
import { Radar, Timeline, Distribution, CategoryBars } from '../components/Charts';
interface ResultData {
  locale?: Locale;
  held: boolean;
  displayed?: Metrics;
  real?: Metrics;
  revealed: boolean;
  alias: string;
  seed: string;
  revealAt: string;
}
export default function Results({ reveal = false }: { reveal?: boolean }) {
  const { t, setLocale } = useLanguage();

  const [r, setR] = useState<ResultData>(),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const fetch = () =>
      api<ResultData>('/session/results')
        .then((data) => {
          if (alive) {
            setR(data);
            setLocale(data.locale || 'en');
            setError('');
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    void fetch();
    const interval = setInterval(fetch, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);
  const m = r?.displayed;
  return (
    <Shell active="Results">
      <ErrorNote error={error} />
      {!r ? (
        <div className="panel empty">
          <h1>{error ? t('No result is available.') : t('Retrieving your report…')}</h1>
          <button className="btn" onClick={() => navigate('/')}>
            {t('Return to workspace')}
          </button>
        </div>
      ) : r.held ? (
        <>
          <PageHead
            eyebrow={t('ASSESSMENT COMPLETE')}
            title={t('Final consistency analysis.')}
            description={t('Your session is complete. Results have not yet been released.')}
          />
          <section className="panel hold-screen">
            <div className="analysis-mark">
              <Icon name="pulse" size={48} />
            </div>
            <Badge tone="amber">{t('Pending operator review')}</Badge>
            <h2>{t('Your work here is done.')}</h2>
            <p>
              {t(
                'The operator will release your report after final review. This page checks automatically; you can safely leave and return using the same browser.',
              )}
            </p>
            <div className="mono small">{t('SESSION SAVED / AWAITING RELEASE')}</div>
          </section>
        </>
      ) : reveal && r.revealed && r.real ? (
        <>
          <PageHead
            eyebrow={t('PROTOCOL COMPLETE / ADMINISTRATIVE DISCLOSURE')}
            title={t('You have been benchmarked.')}
            description={t('The computer is fine. The operator has some explaining to do.')}
          />
          <section className="reveal-hero">
            <Badge>{t('EXPERIMENT: SUCCESSFUL')}</Badge>
            <h2>
              {t('An unreasonable amount')}
              <br />
              {t('of engineering.')}
              <br />
              <em>{t('For this exact moment.')}</em>
            </h2>
            <p>
              {t(
                'You completed real interactive challenges. Your displayed result may have been altered by the administrator. This was a prank. Neither report is an IQ score, medical finding, or psychological diagnosis.',
              )}
            </p>
          </section>
          <div className="comparison-grid">
            <section className="panel">
              <div className="eyebrow">{t('GENUINE CALCULATED PERFORMANCE')}</div>
              <h2 className="comparison-score mono">
                {r.real.index}
                <span> / 1000</span>
              </h2>
              <h3>{t(r.real.classification)}</h3>
              <p>
                {r.real.accuracy}
                {t('% accuracy · ')}
                {r.real.medianReactionMs || '—'} {t(' ms reaction')}
              </p>
            </section>
            <section className="panel">
              <div className="eyebrow">{t('WHAT THE OPERATOR SHOWED YOU')}</div>
              <h2 className="comparison-score mono">
                {m!.index}
                <span> / 1000</span>
              </h2>
              <h3>{t(m!.classification)}</h3>
              <p>{t(m!.recommendation)}</p>
            </section>
          </div>
          <div className="panel">
            <div className="panel-heading">
              <h3>{t('Real vs. displayed dimensions')}</h3>
              <Badge>{t('Full transparency')}</Badge>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('Dimension')}</th>
                    <th>{t('Real / 100')}</th>
                    <th>{t('Displayed / 100')}</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => (
                    <tr key={mod.id}>
                      <td>{t(mod.name)}</td>
                      <td className="mono">{r.real!.categories[mod.id]}</td>
                      <td className="mono">{m!.categories[mod.id]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <section className="panel">
            <h3>{t('Your genuine performance timeline')}</h3>
            <Timeline metrics={r.real} />
          </section>
          <button className="btn secondary" onClick={() => navigate('/results')}>
            {t('Return to displayed report')}
          </button>
        </>
      ) : m ? (
        <>
          <PageHead
            eyebrow={t('PERFORMANCE REPORT / CORTEX BATTERY 01')}
            title={t(`${r.alias} · Assessment complete.`)}
            description={t(
              'An integrated view of your cognitive and operational response profile.',
            )}
            action={
              <button className="btn secondary" onClick={() => window.print()}>
                <Icon name="file" /> {t(' Print report')}
              </button>
            }
          />
          <section className="result-overview">
            <div className="result-index">
              <span className="eyebrow">{t('CORTEX INDEX')}</span>
              <div className="score-reveal mono">
                {m.index}
                <span>/ 1000</span>
              </div>
              <Badge tone="green">{t(m.classification)}</Badge>
              <p>{t('Composite performance within this entertainment battery.')}</p>
            </div>
            <div className="result-rank">
              <span className="eyebrow">{t('FICTIONAL REFERENCE POSITION')}</span>
              <div className="percentile mono">
                {m.percentile}
                <span>{t('th')}</span>
              </div>
              <p>{t('Entertainment benchmark percentile')}</p>
              <div className="benchmark-track">
                <span style={{ left: `${Math.min(98, m.percentile)}%` }} />
              </div>
              <div className="benchmark-labels">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
            <div className="result-radar">
              <Radar metrics={m} />
            </div>
          </section>
          <div className="metric-strip">
            {[
              [
                'Response latency',
                m.medianReactionMs ? `${m.medianReactionMs} ms` : '—',
                m.labels.reaction || 'Median successful response',
              ],
              ['Accuracy', `${m.accuracy}%`, 'Across recorded task responses'],
              [
                'Memory span',
                m.memorySpan || '—',
                m.labels.memory || 'Highest successful sequence',
              ],
              ['Calibration', `${m.calibration}%`, 'Confidence vs. correctness'],
            ].map(([label, val, desc]) => (
              <section key={label as string}>
                <span className="eyebrow">{t(label)}</span>
                <b className="mono">{t(val)}</b>
                <p>{t(desc)}</p>
              </section>
            ))}
          </div>
          <div className="results-grid">
            <section className="panel">
              <div className="panel-heading">
                <h3>{t('Performance trajectory')}</h3>
                <Badge>{t('Accuracy / %')}</Badge>
              </div>
              <Timeline metrics={m} />
              <p className="small muted">
                {t('Each point aggregates up to ten completed trials.')}
              </p>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h3>{t('Response distribution')}</h3>
                <Badge>{t('Reaction time')}</Badge>
              </div>
              <Distribution values={m.distribution} />
            </section>
          </div>
          <div className="results-grid">
            <section className="panel">
              <div className="panel-heading">
                <h3>{t('Dimension profile')}</h3>
                <span className="small muted">{t('Normalized / 100')}</span>
              </div>
              <CategoryBars metrics={m} />
            </section>
            <div className="results-aside">
              <section className="panel analysis-panel">
                <div className="eyebrow">{t('INTERPRETATION')}</div>
                <h3>{t(m.classification)}</h3>
                <p>{t(m.recommendation)}</p>
                <h4>{t('Relative strengths')}</h4>
                {m.strengths.map((s) => (
                  <p className="analysis-line" key={s}>
                    <Icon name="check" size={16} />
                    {t(s)}
                  </p>
                ))}
                <h4>{t('Areas to explore')}</h4>
                {m.weaknesses.map((s) => (
                  <p className="analysis-line" key={s}>
                    <Icon name="arrow" size={16} />
                    {t(s)}
                  </p>
                ))}
              </section>
              <section className="panel">
                <h3>{t('Operational telemetry')}</h3>
                <dl className="metrics-dl">
                  {[
                    ['Consistency', `${m.consistency}%`],
                    ['Precision', `${m.precision}%`],
                    ['False-start rate', `${m.falseStartRate}%`],
                    ['Timing variance', `${m.reactionVariance} ms²`],
                    ['Switch cost proxy', `${m.switchCostMs} ms`],
                    ['Typing speed', `${m.wpm} WPM`],
                    ['Typing corrections', m.corrections],
                    ['Completion', `${m.completion}%`],
                    [
                      'Accuracy change',
                      `${m.fatigue > 0 ? '−' : '+'}${Math.abs(m.fatigue)} points`,
                    ],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <dt>{t(label)}</dt>
                      <dd className="mono">{t(val)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="panel">
                <h3>{t('Confidence calibration')}</h3>
                <Timeline metrics={m} field="confidence" />
                <h3>{t('Response-time / fatigue proxy')}</h3>
                <Timeline metrics={m} field="latency" />
                <p className="small muted">
                  {t('Task mix affects speed. No fatigue or medical diagnosis is inferred.')}
                </p>
              </section>
            </div>
          </div>
          <details className="panel breakdown">
            <summary>{t('Module-by-module report & chart data')}</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('Dimension')}</th>
                    <th>{t('Score / 100')}</th>
                    <th>{t('Fictional range')}</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => (
                    <tr key={mod.id}>
                      <td>{t(mod.name)}</td>
                      <td className="mono">{m.categories[mod.id]}</td>
                      <td>40–75</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table>
                <thead>
                  <tr>
                    <th>{t('Trial block')}</th>
                    <th>{t('Accuracy %')}</th>
                    <th>{t('Latency ms')}</th>
                    <th>{t('Confidence %')}</th>
                  </tr>
                </thead>
                <tbody>
                  {m.timeline.map((t) => (
                    <tr key={t.trial}>
                      <td>{t.trial}</td>
                      <td>{t.accuracy}</td>
                      <td>{t.latency}</td>
                      <td>{t.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="notice">
            {t(
              'Reference ranges and percentiles are fictional features of this entertainment application. Unmeasured dimensions show zero. CORTEX is not a clinical or standardized psychometric instrument.',
            )}
          </div>
          {r.revealed ? (
            <div className="reveal-banner">
              <div>
                <b>{t('There is one final part of your report.')}</b>
                <p>{t('The operator has completed the disclosure stage.')}</p>
              </div>
              <button className="btn" onClick={() => navigate('/reveal')}>
                {t('Open final disclosure ')}
                <Icon name="arrow" />
              </button>
            </div>
          ) : (
            <p className="small muted">
              {t(
                'Final disclosure will appear automatically within 24 hours of release, or sooner when activated by the operator.',
              )}
            </p>
          )}
        </>
      ) : null}
    </Shell>
  );
}
