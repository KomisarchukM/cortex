import { useLanguage } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import type { Answer, Challenge, Participant } from '../../shared/model';
import { locate } from '../../shared/modules';
import { api, navigate } from '../api';
import { Shell, PageHead, Icon, Badge, ErrorNote } from '../components/Chrome';
import Task from '../components/tests/Task';
export default function Assessment() {
  const { t, setLocale } = useLanguage();

  const [s, setS] = useState<Participant>(),
    [c, setC] = useState<Challenge>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [intro, setIntro] = useState(true),
    [breakTime, setBreakTime] = useState(false),
    [observation, setObservation] = useState(''),
    [pending, setPending] = useState<Answer>();
  const block = useRef(-1),
    lastBreak = useRef(0),
    lock = useRef(false);
  async function fetchChallenge(session: Participant) {
    if (session.status === 'complete') {
      navigate('/results');
      return;
    }
    if (session.status === 'paused') return;
    const loc = locate(session.plan, session.cursor)!;
    if (loc.block !== block.current) {
      block.current = loc.block;
      setIntro(true);
    }
    setC(await api<Challenge>('/session/challenge'));
    if (session.elapsedMs - lastBreak.current >= 900000) {
      setBreakTime(true);
      lastBreak.current = session.elapsedMs;
    }
  }
  useEffect(() => {
    api<Participant>('/session')
      .then(async (session) => {
        setS(session);
        setLocale(session.locale || 'en');
        lastBreak.current = session.elapsedMs;
        const raw = localStorage.getItem(`cortex-pending-${session.id}`);
        if (raw) {
          const a = JSON.parse(raw);
          if (a.index === session.cursor) {
            setPending(a);
            setError('A response is waiting to be saved. Retry it to continue.');
          } else localStorage.removeItem(`cortex-pending-${session.id}`);
        }
        await fetchChallenge(session);
      })
      .catch((e) => setError(e.message));
    const blur = () => void api('/session/state', 'POST', { focusLost: true }).catch(() => {});
    window.addEventListener('blur', blur);
    return () => window.removeEventListener('blur', blur);
  }, []);
  async function answer(a: Answer) {
    if (lock.current || !s) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setPending(a);
    localStorage.setItem(`cortex-pending-${s.id}`, JSON.stringify(a));
    try {
      const next = await api<Participant>('/session/answer', 'POST', a);
      localStorage.removeItem(`cortex-pending-${s.id}`);
      localStorage.removeItem(`cortex-draft-${s.id}-${a.index}`);
      setPending(undefined);
      setS(next);
      if (a.falseStart && a.index % 7 === 0)
        setObservation('Predictive capabilities not detected. Wait for the stimulus.');
      else if (c?.family === 'reaction' && a.elapsedMs > 2000 && a.index % 11 === 0)
        setObservation('Network latency cannot explain this.');
      else setObservation('');
      await fetchChallenge(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('.module-intro .btn, .trial-intro .btn, .empty .btn')
        ?.focus(),
    );
  }, [c?.index, intro, s?.status, breakTime]);
  async function pause(paused: boolean) {
    if (busy || pending) return;
    setError('');
    try {
      const next = await api<Participant>('/session/state', 'POST', { paused });
      setS(next);
      setC(undefined);
      if (!paused) await fetchChallenge(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const loc = s ? locate(s.plan, s.cursor) : null;
  const progress = s ? Math.round((s.cursor / s.total) * 100) : 0;
  const estimated =
    s && s.cursor > 5
      ? Math.ceil(((s.elapsedMs / s.cursor) * (s.total - s.cursor)) / 60000)
      : s
        ? s.plan.reduce(
            (sum, p) =>
              sum +
              p.rounds *
                (locate([{ moduleId: p.moduleId, rounds: p.rounds }], 0)?.module.seconds || 15),
            0,
          ) / 60
        : 0;
  return (
    <Shell active="Assessment">
      <PageHead
        eyebrow={t('LIVE ASSESSMENT / PROTOCOL K-17')}
        title={t(
          s
            ? s.status === 'paused'
              ? 'Session paused.'
              : loc?.module.name || 'Session complete'
            : 'Assessment console',
        )}
        description={t(
          s
            ? `${s.alias} · Session ${s.id.slice(0, 8).toUpperCase()}`
            : 'Your saved responses remain available.',
        )}
        action={
          s && s.status === 'active' ? (
            <button
              className="btn secondary"
              disabled={busy || !!pending}
              onClick={() => pause(true)}
            >
              <Icon name="pause" /> {t(' Pause session')}
            </button>
          ) : undefined
        }
      />
      <ErrorNote error={error} />
      {observation && (
        <div className="notice" role="status">
          {observation}
        </div>
      )}
      {!s ? (
        <div className="panel empty">
          <h2>{error ? t('No session is ready.') : t('Retrieving your session…')}</h2>
          <button className="btn" onClick={() => navigate('/')}>
            {t('Return to workspace')}
          </button>
        </div>
      ) : (
        <>
          <div className="assessment-progress">
            <div>
              <span>{t('OVERALL COMPLETION')}</span>
              <b className="mono">{progress}%</b>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-meta">
              <span>
                {t('Module ')}
                {(loc?.block || 0) + 1} / {s.plan.length}
              </span>
              <span>
                {s.cursor} / {s.total} {t(' trials saved')}
              </span>
              <span>
                ~{Math.max(1, Math.round(estimated))} {t(' min remaining')}
              </span>
            </div>
          </div>
          {pending && !busy && error ? (
            <div className="panel empty">
              <h2>{t('Your response is retained.')}</h2>
              <p>{t('Retry to save it before continuing.')}</p>
              <button className="btn" onClick={() => answer(pending)}>
                {t('Retry save')}
              </button>
            </div>
          ) : s.status === 'paused' ? (
            <div className="panel empty">
              <Icon name="pause" size={40} />
              <h2>{t('Take your time.')}</h2>
              <p>
                {t('All ')}
                {s.cursor}{' '}
                {t(
                  ' completed trials are saved. The current timed trial restarts when you resume.',
                )}
              </p>
              <button className="btn" onClick={() => pause(false)}>
                {t('Resume assessment →')}
              </button>
            </div>
          ) : breakTime ? (
            <div className="panel empty">
              <Icon name="clock" size={40} />
              <h2>{t('A good moment to reset.')}</h2>
              <p>
                {t(
                  'You have completed about 15 minutes of active trials. A short break is recommended.',
                )}
              </p>
              <div className="button-row">
                <button
                  className="btn secondary"
                  onClick={() => {
                    setBreakTime(false);
                    void pause(true);
                  }}
                >
                  {t('Take a break')}
                </button>
                <button className="btn" onClick={() => setBreakTime(false)}>
                  {t('Continue')}
                </button>
              </div>
            </div>
          ) : intro && loc ? (
            <div className="module-intro panel">
              <Badge>
                {t('MODULE ')}
                {String(loc.block + 1).padStart(2, '0')}
              </Badge>
              <h2>{t(loc.module.name)}</h2>
              <p>{t(loc.module.instructions)}</p>
              <div className="module-intro-meta">
                <span>
                  {loc.rounds} {t(' adaptive trials')}
                </span>
                <span>
                  {t('Approximately ')}
                  {Math.ceil((loc.rounds * loc.module.seconds) / 60)} {t(' minutes')}
                </span>
                <span>{t('Keyboard & pointer enabled')}</span>
              </div>
              <button className="btn" onClick={() => setIntro(false)}>
                {t('Enter module ')}
                <Icon name="arrow" />
              </button>
            </div>
          ) : c && loc ? (
            <section className="test-panel">
              <div className="test-panel-header">
                <span className="eyebrow">
                  {t(loc.module.name).toUpperCase()} / {String(loc.round + 1).padStart(2, '0')}{' '}
                  {t(' OF')} {loc.rounds}
                </span>
                <Badge>{busy ? t('Saving response…') : t('Instrument ready')}</Badge>
              </div>
              <Task
                key={`${c.index}-${s.status}`}
                challenge={c}
                onAnswer={answer}
                busy={busy}
                draftKey={`cortex-draft-${s.id}-${c.index}`}
              />
              <div className="test-panel-footer">
                <span>
                  <span className="status-dot" /> {t(' Autosave enabled')}
                </span>
                <button
                  className="text-btn"
                  disabled={busy}
                  onClick={() =>
                    answer({
                      index: c.index,
                      value: null,
                      elapsedMs: 0,
                      confidence: 0,
                      skipped: true,
                    })
                  }
                >
                  {t('Skip this trial')}
                </button>
              </div>
            </section>
          ) : (
            <div className="loading">{t('Preparing challenge…')}</div>
          )}
          <div className="assessment-bottom">
            <span className="small muted">
              {t('Accuracy before speed. Breaks are always available.')}
            </span>
            <span className="mono small">
              {t('ENGINE 01 · SEED ')}
              {s.seed.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </>
      )}
    </Shell>
  );
}
