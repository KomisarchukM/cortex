import { useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { modules } from '../../shared/modules';
import { modes, type Mode, type Participant } from '../../shared/model';
import { api, navigate, tone } from '../api';
import { Shell, PageHead, Icon, Badge, ErrorNote } from '../components/Chrome';
export default function Workspace({ protocol, invite }: { protocol?: boolean; invite?: string }) {
  const { t, locale, setLocale } = useLanguage();

  const [mode, setMode] = useState<Mode>('standard'),
    [session, setSession] = useState<Participant>(),
    [onboard, setOnboard] = useState(0),
    [alias, setAlias] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [calibrated, setCalibrated] = useState(false),
    [jitter, setJitter] = useState(0),
    [sound, setSound] = useState(false),
    [customIds, setCustomIds] = useState(['reaction', 'visual-memory', 'logic']),
    [rounds, setRounds] = useState(3),
    [pointer, setPointer] = useState(false),
    [scale, setScale] = useState(100),
    [consent, setConsent] = useState(false);
  useEffect(() => {
    api<{ participant?: Participant }>('/context')
      .then((data) => setSession(data.participant))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!onboard) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('.modal');
    const controls = () => [
      ...(modal?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select,textarea,a[href]',
      ) || []),
    ];
    (onboard === 4 ? modal?.querySelector<HTMLElement>('input') : controls()[0])?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOnboard(0);
      if (e.key === 'Tab') {
        const all = controls(),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [onboard]);
  async function calibrate() {
    setBusy(true);
    const times: number[] = [];
    let last = performance.now();
    for (let i = 0; i < 20; i++)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          const current = performance.now();
          times.push(current - last);
          last = current;
          resolve();
        }),
      );
    const avg = times.reduce((s, n) => s + n) / times.length;
    setJitter(Math.round(Math.max(...times) - Math.min(...times)));
    setCalibrated(avg < 100);
    setBusy(false);
  }
  async function begin() {
    setBusy(true);
    setError('');
    try {
      await api('/sessions', 'POST', {
        alias,
        mode,
        locale,
        invite,
        custom: mode === 'custom' ? { moduleIds: customIds, rounds } : undefined,
      });
      navigate('/assessment');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (protocol)
    return (
      <Shell active="Protocol">
        <PageHead
          eyebrow={t('PROTOCOL / 01')}
          title={t('The assessment battery')}
          description={t(
            'Thirty dimensions. Procedural challenges. One deliberately thorough protocol.',
          )}
        />
        <div className="notice">
          {t(
            'CORTEX is an original entertainment application. Browser measurements are approximate; benchmarks are fictional. Results are not IQ scores, medical findings, or employment advice.',
          )}
        </div>
        <div className="protocol-list">
          {modules.map((m, i) => (
            <article key={m.id}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h2>{t(m.name)}</h2>
                <p>{t(m.instructions)}</p>
              </div>
              <Badge>{t(m.family)}</Badge>
            </article>
          ))}
        </div>
      </Shell>
    );
  return (
    <Shell>
      <PageHead
        eyebrow={t('ASSESSMENT WORKSPACE')}
        title={t('Meet your operating potential.')}
        description={t('A closer look at how you think, respond, and adapt.')}
        action={
          <div className="workspace-actions">
            <div className="language-select">
              <label htmlFor="assessment-language">{t('Language')}</label>
              <select
                id="assessment-language"
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'en' | 'uk')}
              >
                <option value="en">English</option>
                <option value="uk">Українська</option>
              </select>
            </div>
            <Badge tone="green">
              <span className="status-dot" /> {t(' Laboratory ready')}
            </Badge>
          </div>
        }
      />
      {session && session.status !== 'complete' && (
        <div className="resume-banner">
          <div>
            <b>
              {t('Welcome back, ')}
              {session.alias}.
            </b>
            <span>
              {session.cursor} {t(' of ')}
              {session.total} {t(' trials saved. Your battery is ready to resume.')}
            </span>
          </div>
          <button className="btn" onClick={() => navigate('/assessment')}>
            {t('Resume session ')}
            <Icon name="arrow" />
          </button>
        </div>
      )}
      <section className="workspace-hero">
        <div className="hero-copy">
          <span className="eyebrow">{t('CORTEX BATTERY / REVISION 01')}</span>
          <h2>
            {t('The human system.')}
            <br />
            {t('Under observation.')}
          </h2>
          <p>
            {t(
              'Reaction. Recall. Reasoning. Discover the shape of your performance through an adaptive, interactive assessment.',
            )}
          </p>
          <div className="hero-meta">
            <span>
              <Icon name="pulse" size={17} /> {t(' 30 performance dimensions')}
            </span>
            <span>
              <Icon name="shield" size={17} /> {t(' Progress saved automatically')}
            </span>
          </div>
        </div>
        <div className="instrument-art" aria-hidden="true">
          <svg viewBox="0 0 380 300">
            <defs>
              <pattern id="cross" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M10 8v4m-2-2h4" stroke="#44504a" strokeWidth=".6" />
              </pattern>
            </defs>
            <rect width="380" height="300" fill="url(#cross)" />
            {[44, 75, 106].map((r) => (
              <circle
                key={r}
                cx="190"
                cy="148"
                r={r}
                fill="none"
                stroke="#55675b"
                strokeWidth=".7"
              />
            ))}
            <path d="M48 148h284M190 22v252" stroke="#526358" strokeWidth=".7" />
            <path
              d="m190 42 70 57 32 94-102 64-89-79 24-90Z"
              fill="#b8d4b9"
              fillOpacity=".08"
              stroke="#bdcfb3"
              strokeWidth="1.5"
            />
            <path
              d="m190 83 45 40 23 62-68 31-57-49 16-60Z"
              fill="#b8d4b9"
              fillOpacity=".12"
              stroke="#86a38c"
              strokeWidth="1"
            />
            {[
              [190, 42],
              [260, 99],
              [292, 193],
              [190, 257],
              [101, 178],
              [125, 88],
            ].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="3" fill="#c5d4b8" />
                <text
                  x={x + (x < 190 ? -18 : 8)}
                  y={y - 8}
                  fill="#b0beb0"
                  fontFamily="monospace"
                  fontSize="9"
                >
                  0{i + 1}
                </text>
              </g>
            ))}
            <text x="21" y="284" fill="#9da99f" fontSize="9" fontFamily="monospace">
              {t('RESPONSE MODEL / AWAITING INPUT')}
            </text>
            <text x="276" y="25" fill="#b9c7b8" fontSize="9" fontFamily="monospace">
              {t('K–17')}
            </text>
          </svg>
          <div className="instrument-label">
            <span className="status-dot" /> {t(' MODEL INITIALIZED')}
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t('01 / SELECT A PROTOCOL')}</span>
          <h2>{t('How deep do you want to go?')}</h2>
        </div>
        <span className="muted small">{t('Every mode supports pause & resume')}</span>
      </div>
      <div className="mode-grid">
        {Object.entries(modes).map(([key, m], i) => (
          <button
            key={key}
            className={`mode-card ${mode === key ? 'selected' : ''}`}
            onClick={() => setMode(key as Mode)}
            aria-pressed={mode === key}
          >
            <div className="mode-top">
              <span className="mono">
                {t('P')}
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="radio-dot" />
            </div>
            <h3>{t(m.name)}</h3>
            <p>{t(m.description)}</p>
            <div className="mode-duration">
              <b>{key === 'extended' ? t('90–120') : m.minutes}</b>
              <span>{t('MINUTES')}</span>
              {key === 'standard' && <Badge>{t('Recommended')}</Badge>}
            </div>
          </button>
        ))}
      </div>
      <div className="selection-bar">
        <button
          className="text-btn"
          onClick={() => setMode(mode === 'custom' ? 'standard' : 'custom')}
        >
          <Icon name="settings" size={16} />{' '}
          {mode === 'custom' ? t('Use a preset protocol') : t('Configure a custom battery')}
        </button>
        <button
          className="btn"
          onClick={() => {
            setError('');
            setOnboard(1);
          }}
          disabled={!!session && session.status !== 'complete'}
        >
          {t('Prepare assessment ')}
          <Icon name="arrow" />
        </button>
      </div>
      {mode === 'custom' && (
        <section className="panel custom-panel">
          <h3>{t('Custom assessment')}</h3>
          <label>
            {t('Trials per dimension')}
            <input
              type="number"
              min="1"
              max="100"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
            />
          </label>
          <div className="check-grid">
            {modules.map((m) => (
              <label key={m.id}>
                <input
                  type="checkbox"
                  checked={customIds.includes(m.id)}
                  onChange={(e) =>
                    setCustomIds(
                      e.target.checked
                        ? [...customIds, m.id]
                        : customIds.filter((id) => id !== m.id),
                    )
                  }
                />
                {t(m.name)}
              </label>
            ))}
          </div>
        </section>
      )}
      <div className="lower-grid">
        <section className="panel dimension-panel">
          <div className="panel-heading">
            <h3>{t('A multidimensional view')}</h3>
            <button className="text-btn" onClick={() => navigate('/protocol')}>
              {t('View protocol ')}
              <Icon name="arrow" size={16} />
            </button>
          </div>
          {[
            ['01', 'Cognitive response', 'Reaction time, inhibition, attention'],
            ['02', 'Memory systems', 'Visual, working, sequence & verbal memory'],
            ['03', 'Reasoning & recognition', 'Logic, numerical, pattern & spatial tasks'],
            ['04', 'Operational control', 'Precision, switching, multitasking & adaptation'],
          ].map(([num, title, desc]) => (
            <div className="dimension-row" key={num}>
              <span className="mono">{num}</span>
              <div>
                <b>{t(title)}</b>
                <p>{t(desc)}</p>
              </div>
              <span>↗</span>
            </div>
          ))}
        </section>
        <section className="panel briefing">
          <div className="eyebrow">{t('BEFORE YOU BEGIN')}</div>
          <h3>
            {t('A little preparation.')}
            <br />
            {t('A better measurement.')}
          </h3>
          <p>
            {t(
              'Use a quiet space and a comfortable input device. Give the task your attention. Take a break whenever you need one.',
            )}
          </p>
          <div>
            <Icon name="clock" /> {t(' Choose a protocol you have time for.')}
          </div>
          <div>
            <Icon name="shield" /> {t(' An alias is all we need.')}
          </div>
          <div className="small muted">
            {t('Entertainment software. Not a medical, psychological, or IQ assessment.')}
          </div>
        </section>
      </div>
      {onboard > 0 && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboard-title"
          >
            <div className="modal-header">
              <span className="eyebrow">
                {t('PREPARATION / ')}
                {onboard} {t(' OF 4')}
              </span>
              <button
                className="text-btn"
                aria-label={t('Close preparation')}
                onClick={() => setOnboard(0)}
              >
                ✕
              </button>
            </div>
            <h2 id="onboard-title">
              {t(
                [
                  '',
                  'Welcome to the laboratory.',
                  'Check your instruments.',
                  'Set your testing environment.',
                  'Assign your participant alias.',
                ][onboard],
              )}
            </h2>
            <ErrorNote error={error} />
            {onboard === 1 && (
              <>
                <p>
                  {t(
                    'This battery contains real interactive challenges and approximate performance telemetry. It is an entertainment experience with fictional reference ranges, and offers no diagnostic conclusions.',
                  )}
                </p>
                <div className="protocol-note">
                  <span className="mono">{t('BRIEFING K-17')}</span>
                  <p>
                    {t('Reference material: ')}
                    <b>{t('Copper')}</b>
                    <br />
                    {t('Baseline station: ')}
                    <b>{t('North')}</b>
                  </p>
                </div>
                <p className="small muted">
                  {t(
                    'Only task inputs are stored. No camera, microphone, location, or personal details are requested.',
                  )}
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {t('I understand and want to participate.')}
                </label>
              </>
            )}
            {onboard === 2 && (
              <>
                <div className="compat-row">
                  <span>{t('Browser compatibility')}</span>
                  <Badge tone="green">
                    {typeof performance !== 'undefined' ? t('Compatible') : t('Check browser')}
                  </Badge>
                </div>
                <div className="compat-row">
                  <span>{t('Input-device check')}</span>
                  <button className="btn secondary" onClick={() => setPointer(true)}>
                    {pointer ? t('Input confirmed') : t('Test input')}
                  </button>
                </div>
                <div className="compat-row">
                  <span>{t('Browser timing calibration')}</span>
                  <button className="btn secondary" disabled={busy} onClick={calibrate}>
                    {busy
                      ? t('Estimating scheduling variance…')
                      : calibrated
                        ? t(`${jitter} ms scheduling range`)
                        : t('Calibrate timing')}
                  </button>
                </div>
                <p className="small muted">
                  {t(
                    'Browser timing varies with hardware and scheduling. These measurements are approximate.',
                  )}
                </p>
                <label>
                  {t('Display-size calibration (')}
                  {scale}%)
                  <input
                    type="range"
                    min="75"
                    max="125"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                  />
                </label>
                <div className="calibration-ruler" style={{ width: `${scale * 1.5}px` }}>
                  {t('Reference ruler · 150 units')}
                </div>
                <div className="compat-row">
                  <span>{t('Sound check')}</span>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      tone();
                      setSound(true);
                    }}
                  >
                    {t('Play quiet tone')}
                  </button>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!sound}
                    onChange={(e) => setSound(!e.target.checked)}
                  />
                  {t('Mute tones; use visual cues')}
                </label>
              </>
            )}
            {onboard === 3 && (
              <>
                <p>
                  {t(
                    'Place the window where you can see it clearly. Close distractions if you wish. CORTEX does not lock your browser or require fullscreen.',
                  )}
                </p>
                <ul className="plain-list">
                  <li>{t('Use the same input device throughout the battery.')}</li>
                  <li>{t('Read each module’s instructions before starting.')}</li>
                  <li>{t('Pause at any time. Completed responses are saved.')}</li>
                  <li>{t('Break reminders appear about every 15 minutes.')}</li>
                </ul>
                <div className="protocol-note">
                  <b>{t(mode === 'custom' ? 'Custom Assessment' : modes[mode].name)}</b>
                  <p>
                    {mode === 'custom'
                      ? t(`${customIds.length} dimensions · ${rounds} trials each`)
                      : t(`Approximately ${modes[mode].minutes} minutes`)}
                  </p>
                </div>
              </>
            )}
            {onboard === 4 && (
              <>
                <label>
                  {t('Participant alias')}
                  <input
                    autoFocus
                    maxLength={40}
                    placeholder={t('e.g. Subject 001')}
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </label>
                <p className="small muted">
                  {t(
                    'Use a nickname. Please do not enter your real name or sensitive information.',
                  )}
                </p>
                <div className="notice">
                  {t(
                    'Your protocol is ready. Generating the adaptive challenge model begins when you start.',
                  )}
                </div>
              </>
            )}
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => (onboard === 1 ? setOnboard(0) : setOnboard(onboard - 1))}
              >
                {onboard === 1 ? t('Cancel') : t('Back')}
              </button>
              <button
                className="btn"
                disabled={
                  busy ||
                  (onboard === 1 && !consent) ||
                  (onboard === 2 && (!pointer || !calibrated)) ||
                  (onboard === 4 && (!alias.trim() || (mode === 'custom' && !customIds.length)))
                }
                onClick={() => {
                  localStorage.setItem('cortex-muted', String(!sound));
                  onboard < 4 ? setOnboard(onboard + 1) : void begin();
                }}
              >
                {t(onboard === 4 ? (busy ? 'Initializing…' : 'Begin assessment') : 'Continue')}
                <Icon name="arrow" />
              </button>
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}
