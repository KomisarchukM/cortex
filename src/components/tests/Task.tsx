import { useLanguage } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import type { Answer, Challenge } from '../../../shared/model';
import { tone } from '../../api';
import {
  DetectionInstrument,
  IntervalInstrument,
  MotorInstrument,
  MultiInstrument,
} from './Instruments';
const symbols = ['○', '△', '□', '◇', '✕', '⊕', '▱', '⊗', '⊙', '∥'];
export default function Task({
  challenge: c,
  onAnswer,
  busy,
  draftKey,
}: {
  challenge: Challenge;
  onAnswer: (a: Answer) => void;
  busy: boolean;
  draftKey: string;
}) {
  const { t } = useLanguage();

  const [started, setStarted] = useState(false),
    [stage, setStage] = useState('ready'),
    [frame, setFrame] = useState(-1),
    [value, setValue] = useState<any>(() => {
      try {
        return JSON.parse(localStorage.getItem(draftKey) || 'null');
      } catch {
        return null;
      }
    }),
    [confidence, setConfidence] = useState(70),
    [corrections, setCorrections] = useState(0);
  const start = useRef(performance.now()),
    cue = useRef(0),
    stageRef = useRef(stage),
    callback = useRef(onAnswer),
    submitted = useRef(false);
  stageRef.current = stage;
  callback.current = onAnswer;
  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(value));
  }, [value, draftKey]);
  useEffect(() => {
    if (!started) return;
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          '.task-instrument input:not([type=range]), .task-instrument textarea, .task-instrument button:not(:disabled), .task-instrument [tabindex="0"]',
        )
        ?.focus(),
    );
  }, [started, stage]);
  function submit(
    v = value,
    elapsed = performance.now() - start.current,
    extra: Partial<Answer> = {},
  ) {
    if (busy || submitted.current) return;
    submitted.current = true;
    callback.current({
      index: c.index,
      value: v,
      elapsedMs: Math.max(0, elapsed),
      confidence,
      corrections,
      ...extra,
    });
  }
  // Failed network submissions can retry without losing the task response.
  useEffect(() => {
    if (!busy) submitted.current = false;
  }, [busy]);
  useEffect(() => {
    if (!started) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    start.current = performance.now();
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };
    if (c.family === 'reaction') {
      setStage('wait');
      later(() => {
        cue.current = performance.now();
        setStage(c.data.go ? 'go' : 'hold');
        if (c.data.variant === 'tone' && localStorage.getItem('cortex-muted') !== 'true') tone();
        later(
          () => submit(c.data.go ? null : 'withhold', c.data.windowMs, { skipped: c.data.go }),
          c.data.windowMs,
        );
      }, c.data.delay);
    } else if (['grid', 'recognition'].includes(c.family) && c.data.exposureMs) {
      setStage('study');
      later(() => {
        if (c.data.delayed) {
          setStage('delay');
          later(() => {
            start.current = performance.now();
            setStage('respond');
          }, c.data.delayMs);
        } else {
          start.current = performance.now();
          setStage('respond');
        }
      }, c.data.exposureMs);
    } else if (['span', 'sequence'].includes(c.family)) {
      setStage('study');
      c.data.sequence.forEach((_: number, i: number) =>
        later(() => setFrame(i), i * c.data.stepMs),
      );
      later(
        () => {
          setFrame(-1);
          start.current = performance.now();
          setStage('respond');
        },
        c.data.sequence.length * c.data.stepMs + 400,
      );
    } else setStage('respond');
    return () => timers.forEach(clearTimeout);
    // Challenge identity is the reset boundary; response edits must not restart timers.
  }, [started, c]);
  function react(choice?: string) {
    if (stageRef.current === 'wait')
      submit(null, performance.now() - start.current, { falseStart: true });
    else if (stageRef.current === 'hold')
      submit(null, performance.now() - cue.current, { falseStart: true });
    else if (stageRef.current === 'go') submit(choice || 'GO', performance.now() - cue.current);
  }
  useEffect(() => {
    if (c.family !== 'reaction' || !started) return;
    const handler = (e: KeyboardEvent) => {
      if (['Space', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        react(
          c.data.variant === 'choice'
            ? e.code === 'ArrowLeft'
              ? 'LEFT'
              : e.code === 'ArrowRight'
                ? 'RIGHT'
                : 'GO'
            : 'GO',
        );
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  const selected = (v: number) => {
    const list: Array<number> = Array.isArray(value) ? value : [];
    setValue(list.includes(v) ? list.filter((n) => n !== v) : [...list, v]);
  };
  const direct = ['reaction', 'search', 'switch', 'interval', 'motor', 'multi'].includes(c.family);
  if (!started)
    return (
      <div className="trial-intro">
        <span className="crosshair">+</span>
        <h3>{t('Ready when you are.')}</h3>
        <p>{t(c.prompt)}</p>
        <div className="trial-specs">
          <span>
            {t('DIFFICULTY ')}
            <b>{c.difficulty} / 8</b>
          </span>
          <span>
            {t('TRIAL ')}
            <b>{c.index + 1}</b>
          </span>
        </div>
        <button className="btn" onClick={() => setStarted(true)}>
          {t('Start trial →')}
        </button>
      </div>
    );
  let instrument;
  switch (c.family) {
    case 'reaction':
      instrument = (
        <div className={`reaction-field ${stage}`}>
          <button
            className="reaction-hit"
            disabled={busy}
            onPointerDown={(e) => {
              if (c.data.variant !== 'choice') {
                e.preventDefault();
                react();
              }
            }}
            onClick={(e) => {
              if (e.detail === 0 && c.data.variant !== 'choice') react();
            }}
          >
            <span className="stimulus-dot" />
            <strong>
              {stage === 'wait'
                ? t('Wait for the signal')
                : stage === 'go'
                  ? c.data.variant === 'choice'
                    ? t(c.data.cue)
                    : t('Respond now')
                  : stage === 'hold'
                    ? t('HOLD — do not respond')
                    : t('Initializing')}
            </strong>
            <span>
              {stage === 'wait'
                ? t('Keep your response ready.')
                : c.data.variant === 'choice'
                  ? t('Use left/right arrows or the controls below.')
                  : t('Click, tap, or press Space.')}
            </span>
          </button>
          {c.data.variant === 'choice' && (
            <div className="reaction-choices">
              <button className="btn secondary" onClick={() => react('LEFT')}>
                {t('← LEFT')}
              </button>
              <button className="btn secondary" onClick={() => react('RIGHT')}>
                {t('RIGHT →')}
              </button>
            </div>
          )}
        </div>
      );
      break;
    case 'grid':
      instrument = (
        <>
          <p className="instrument-instruction">
            {stage === 'study'
              ? t('Observe the pattern.')
              : t('Reconstruct the illuminated cells.')}
          </p>
          <div
            className="memory-grid"
            style={{ gridTemplateColumns: `repeat(${c.data.size},1fr)` }}
          >
            {Array.from({ length: c.data.size ** 2 }, (_, i) => (
              <button
                key={i}
                disabled={stage === 'study'}
                aria-label={t(`Cell ${i + 1}`)}
                aria-pressed={
                  stage === 'study' ? c.data.cells.includes(i) : value?.includes(i) || false
                }
                className={
                  (stage === 'study' ? c.data.cells.includes(i) : value?.includes(i)) ? 'lit' : ''
                }
                onClick={() => selected(i)}
              >
                <span>{stage === 'study' ? t('') : i + 1}</span>
              </button>
            ))}
          </div>
        </>
      );
      break;
    case 'span':
      instrument = (
        <>
          <div className="span-display mono">
            {stage === 'study' && frame >= 0 ? (
              c.data.variant === 'symbols' ? (
                symbols[c.data.sequence[frame]]
              ) : c.data.variant === 'spatial' ? (
                <div className="spatial-span-grid">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className={c.data.sequence[frame] === i ? 'lit' : ''}>
                      {i}
                    </span>
                  ))}
                </div>
              ) : (
                c.data.sequence[frame]
              )
            ) : stage === 'study' ? (
              '·'
            ) : (
              '?'
            )}
          </div>
          {stage === 'respond' && (
            <>
              <p>{t(c.prompt)}</p>
              {c.data.variant === 'symbols' && (
                <div className="symbol-key">
                  {symbols.map((s, i) => (
                    <span key={i}>
                      {s} = {i}
                    </span>
                  ))}
                </div>
              )}
              <label>
                {t('Sequence')}
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={12}
                  value={value || ''}
                  onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={t('Enter digits without spaces')}
                />
              </label>
            </>
          )}
        </>
      );
      break;
    case 'sequence':
      instrument = (
        <>
          <div className="sequence-pad">
            {Array.from({ length: 6 }, (_, i) => (
              <button
                key={i}
                className={`seq-${i} ${stage === 'study' && c.data.sequence[frame] === i ? 'flash' : ''}`}
                disabled={stage === 'study'}
                aria-label={t(`Position ${i + 1}`)}
                onClick={() => setValue([...(Array.isArray(value) ? value : []), i])}
              >
                {c.data.variant === 'shapes' ? symbols[i] : i + 1}
              </button>
            ))}
          </div>
          {stage === 'respond' && (
            <div className="sequence-output">
              <span className="mono">
                {(value || []).map((i: number) => i + 1).join(' → ') ||
                  t('Your sequence will appear here')}
              </span>
              <button className="text-btn" onClick={() => setValue([])}>
                {t('Clear')}
              </button>
            </div>
          )}
        </>
      );
      break;
    case 'recognition':
      instrument =
        stage === 'study' ? (
          <div className="word-study">
            {c.data.study.map((w: string) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        ) : stage === 'delay' ? (
          <div className="span-display">
            <span className="muted">
              {t('Hold the words in memory.')}
              <br />
              <small>3 + 4 = 7 · 5 + 2 = 7</small>
            </span>
          </div>
        ) : c.data.recall ? (
          <label>
            {t('Word sequence')}
            <input
              autoFocus
              value={value || ''}
              onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s+/g, ' '))}
            />
          </label>
        ) : (
          <OptionList c={c} value={value} setValue={setValue} />
        );
      break;
    case 'search':
      instrument = c.data.stream ? (
        <DetectionInstrument challenge={c} done={(v, ms) => submit(v, ms)} />
      ) : (
        <div className={c.data.distractors ? 'search-wrap distractor-field' : 'search-wrap'}>
          <div className="search-legend">
            {t('TARGET ')}
            <b>{c.data.targetSymbol}</b>
            <span>
              {c.data.symbols.length} {t(' symbols')}
            </span>
          </div>
          <div className="search-grid">
            {c.data.symbols.map((s: string, i: number) => (
              <button key={i} aria-label={t(`Symbol ${i + 1}: ${s}`)} onClick={() => submit(i)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      );
      break;
    case 'stroop':
      instrument = (
        <>
          <div className={`stroop-word ink-${c.data.ink}`}>{t(c.data.word)}</div>
          <p className="center muted">{t('Choose the ink color.')}</p>
          <OptionList c={c} value={value} setValue={setValue} />
        </>
      );
      break;
    case 'match':
      instrument = (
        <>
          <div className="symbol-key">
            {c.data.symbols.map((s: string, i: number) => (
              <span key={i}>
                <b>{s}</b>
                <small>{c.data.key[i]}</small>
              </span>
            ))}
          </div>
          <div className="match-target">{c.data.target}</div>
          <OptionList c={c} value={value} setValue={setValue} />
        </>
      );
      break;
    case 'choice':
    case 'decision':
      instrument = (
        <>
          <div className="question-prompt">{t(c.prompt)}</div>
          {c.family === 'decision' && (
            <div className="decision-model">
              <div>
                <span>{t('POLICY A')}</span>
                <b>40</b>
                <small>{t('certain points')}</small>
              </div>
              <div>
                <span>{t('POLICY B')}</span>
                <b>{c.data.payout}</b>
                <small>
                  {c.data.prob}
                  {t('% probability')}
                </small>
              </div>
            </div>
          )}
          <OptionList c={c} value={value} setValue={setValue} />
        </>
      );
      break;
    case 'pattern':
      instrument = (
        <>
          <div className={c.data.matrix ? 'pattern-matrix' : 'pattern-strip'}>
            {(c.data.matrix || c.data.series).map((v: number, i: number) => (
              <div key={i}>
                {c.data.matrix && i === 8 ? (
                  <span className="missing-pattern">?</span>
                ) : c.data.variant === 1 ? (
                  <span className="rotation-arrow" style={{ transform: `rotate(${v}deg)` }}>
                    ↑
                  </span>
                ) : (
                  <div className="dot-pattern">
                    {Array.from({ length: v }, (_, j) => (
                      <span key={j} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!c.data.matrix && <div className="missing-pattern">?</div>}
          </div>
          <p className="center muted">{t(c.prompt)}</p>
          <OptionList c={c} value={value} setValue={setValue} />
        </>
      );
      break;
    case 'spatial':
      instrument = (
        <>
          <div className="spatial-objects">
            <div>
              <span className="eyebrow">{t('REFERENCE')}</span>
              <Shape angle={0} />
            </div>
            <div>
              <span className="eyebrow">
                {c.data.variant === 1 ? t('COMPARISON') : t('TRANSFORM')}
              </span>
              {c.data.variant === 1 ? (
                <Shape angle={c.data.angle} mirror={c.data.mirror} />
              ) : c.data.variant === 2 ? (
                <div className="route-grid">
                  {t('N ↑')}
                  <br />
                  {t('W ← + → E')}
                  <br />
                  {t('S ↓')}
                </div>
              ) : (
                <span className="spatial-angle mono">{c.data.angle}° ↻</span>
              )}
            </div>
          </div>
          <p className="center">{t(c.prompt)}</p>
          {c.data.variant === 0 ? (
            <div className="orientation-options">
              {c.options!.map((v, i) => (
                <button
                  key={v}
                  aria-label={t(v)}
                  className={value === i ? 'selected' : ''}
                  onClick={() => setValue(i)}
                >
                  <Shape angle={i * 90} />
                  <span>{v}</span>
                </button>
              ))}
            </div>
          ) : (
            <OptionList c={c} value={value} setValue={setValue} />
          )}
        </>
      );
      break;
    case 'switch':
      instrument = (
        <>
          <div className="rule-band">
            {t('CURRENT RULE / ')}
            {t(c.data.rule)}
            {c.data.flip ? t(' · REVERSED') : t('')}
          </div>
          <div
            className={`switch-stimulus ${c.data.square ? 'square' : 'circle'} ink-${c.data.color === 'BLUE' ? 0 : 1}`}
          >
            {c.data.number}
          </div>
          <div className="option-grid">
            {c.options!.map((v, i) => (
              <button className="option" key={v} onClick={() => submit(i)}>
                {v}
              </button>
            ))}
          </div>
        </>
      );
      break;
    case 'multi':
      instrument = <MultiInstrument challenge={c} done={(v, ms) => submit(v, ms)} />;
      break;
    case 'interval':
      instrument = <IntervalInstrument challenge={c} done={(v, ms) => submit(v, ms)} />;
      break;
    case 'motor':
      instrument = <MotorInstrument challenge={c} done={(v, ms) => submit(v, ms)} />;
      break;
    case 'estimate':
      instrument = (
        <>
          <div className="estimate-art">
            {c.data.variant === 0 ? (
              <svg viewBox="0 0 100 100" role="img" aria-label={t('Dot field to estimate')}>
                {c.data.dots.map(([x, y]: number[], i: number) => (
                  <circle key={i} cx={x} cy={y} r="1.4" fill="currentColor" />
                ))}
              </svg>
            ) : c.data.variant === 1 ? (
              <svg viewBox="0 0 200 150" role="img" aria-label={t('Angle to estimate')}>
                <path
                  d={`M180 120H100L${100 + 80 * Math.cos((c.data.angle * Math.PI) / 180)} ${120 - 80 * Math.sin((c.data.angle * Math.PI) / 180)}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="100" cy="120" r="4" fill="currentColor" />
              </svg>
            ) : (
              <div className="estimate-ruler">
                <div style={{ width: `${c.data.percent}%` }} />
              </div>
            )}
          </div>
          <label>
            {c.data.variant === 0
              ? t('Estimated count')
              : c.data.variant === 1
                ? t('Estimated degrees')
                : t('Estimated percentage')}
            <input
              inputMode="numeric"
              type="number"
              min="0"
              max="500"
              value={value ?? ''}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </label>
        </>
      );
      break;
    case 'typing':
      instrument = (
        <>
          <div className="typing-passage">
            {c.data.passage.split('').map((char: string, i: number) => (
              <span
                key={i}
                className={
                  i < String(value || '').length
                    ? String(value)[i] === char
                      ? 'typed-correct'
                      : 'typed-error'
                    : ''
                }
              >
                {char}
              </span>
            ))}
          </div>
          <label>
            {t('Transcription')}
            <textarea
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              value={value || ''}
              onChange={(e) => {
                if (e.target.value.length < String(value || '').length)
                  setCorrections((n) => n + 1);
                setValue(e.target.value);
              }}
              maxLength={2000}
            />
          </label>
          <span className="mono small">
            {String(value || '').length} / {c.data.passage.length} {t(' CHARACTERS')}
          </span>
        </>
      );
      break;
    case 'error':
      instrument = (
        <div className="error-table">
          <div className="error-table-head">
            <span>{t('REFERENCE')}</span>
            <span>{t('OBSERVATION')}</span>
          </div>
          {c.data.rows.map((r: any, i: number) => (
            <button key={i} className={value === i ? 'selected' : ''} onClick={() => setValue(i)}>
              <span className="mono">{r.left}</span>
              <span className="mono">{r.right}</span>
            </button>
          ))}
        </div>
      );
      break;
    case 'rule':
      instrument = (
        <>
          <div className="rule-examples">
            <section>
              <span className="eyebrow">{t('ACCEPTED')}</span>
              <div>
                {c.data.examples.map((n: number) => (
                  <b key={n}>{n}</b>
                ))}
              </div>
            </section>
            <section>
              <span className="eyebrow">{t('REJECTED')}</span>
              <div>
                {c.data.negative.map((n: number) => (
                  <b key={n}>{n}</b>
                ))}
              </div>
            </section>
          </div>
          <p className="center">{t(c.prompt)}</p>
          <OptionList c={c} value={value} setValue={setValue} />
        </>
      );
      break;
  }
  return (
    <div className="task-active">
      <div className="task-instrument">{instrument}</div>
      {!direct && stage === 'respond' && (
        <div className="task-submit">
          <label className="confidence-control">
            {t('Confidence ')}
            <span className="mono">{confidence}%</span>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
            />
          </label>
          <button className="btn" disabled={busy || value === null} onClick={() => submit()}>
            {busy ? t('Saving…') : t('Submit response →')}
          </button>
        </div>
      )}
    </div>
  );
}
function OptionList({
  c,
  value,
  setValue,
}: {
  c: Challenge;
  value: any;
  setValue: (v: number) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="option-grid">
      {c.options?.map((option, i) => (
        <button
          key={`${option}-${i}`}
          aria-pressed={value === i}
          className={`option ${value === i ? 'selected' : ''}`}
          onClick={() => setValue(i)}
        >
          <span className="option-number mono">{String(i + 1).padStart(2, '0')}</span>
          {t(option)}
        </button>
      ))}
    </div>
  );
}
function Shape({ angle, mirror }: { angle: number; mirror?: boolean }) {
  return (
    <svg className="spatial-shape" viewBox="0 0 100 100" aria-hidden="true">
      <g
        transform={`translate(50 50) rotate(${angle}) scale(${mirror ? -1 : 1} 1) translate(-50 -50)`}
      >
        <path
          d="M22 18H42V58H76V78H22Z"
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <circle cx="32" cy="28" r="4" fill="var(--accent)" />
      </g>
    </svg>
  );
}
