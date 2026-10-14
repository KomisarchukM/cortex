import { useLanguage } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import type { Challenge } from '../../../shared/model';
import { Icon } from '../Chrome';
type Done = (value: any, elapsed: number) => void;
export function DetectionInstrument({ challenge: c, done }: { challenge: Challenge; done: Done }) {
  const { t } = useLanguage();

  const [frame, setFrame] = useState(0),
    [hits, setHits] = useState<number[]>([]);
  const start = useRef(performance.now()),
    answers = useRef<number[]>([]),
    current = useRef(0),
    finish = useRef(done);
  finish.current = done;
  useEffect(() => {
    const id = setInterval(() => {
      const next = current.current + 1;
      if (next >= c.data.stream.length) {
        clearInterval(id);
        finish.current(answers.current, performance.now() - start.current);
      } else {
        current.current = next;
        setFrame(next);
      }
    }, c.data.stepMs);
    return () => clearInterval(id);
  }, [c]);
  function detect() {
    if (!answers.current.includes(current.current)) {
      answers.current = [...answers.current, current.current];
      setHits(answers.current);
    }
  }
  return (
    <div className="detection-instrument">
      <div className="rule-band">
        {t('TARGET / ')}
        {c.data.targetSymbol} · {frame + 1} {t(' OF ')}
        {c.data.stream.length}
      </div>
      <div className="detection-symbol">{c.data.stream[frame]}</div>
      <button className="btn" onClick={detect}>
        {t('Target detected')}
      </button>
      <p className="small muted">
        {hits.length} {t(' detections recorded · Focus the button and use Space or Enter.')}
      </p>
    </div>
  );
}
export function IntervalInstrument({ challenge: c, done }: { challenge: Challenge; done: Done }) {
  const { t } = useLanguage();

  const [running, setRunning] = useState(false);
  const start = useRef(0);
  return (
    <div className="interval-instrument">
      <div className={`interval-orbit ${running ? 'running' : ''}`}>
        <span>{running ? t('OBSERVING') : t('READY')}</span>
      </div>
      <h3>{running ? t('Trust your internal clock.') : t(`${c.data.seconds} seconds`)}</h3>
      <p className="muted">{t('The clock is hidden during reproduction.')}</p>
      <button
        className="btn"
        onClick={() => {
          if (!running) {
            start.current = performance.now();
            setRunning(true);
          } else {
            const ms = performance.now() - start.current;
            done(ms, ms);
          }
        }}
      >
        {running ? t('Stop interval') : t('Start interval')}
      </button>
    </div>
  );
}
export function MotorInstrument({ challenge: c, done }: { challenge: Challenge; done: Done }) {
  const { t } = useLanguage();

  const [index, setIndex] = useState(0),
    [errors, setErrors] = useState<number[]>([]),
    [marker, setMarker] = useState(5);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const start = useRef(performance.now());
  const field = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const variant = c.data.variant;
  useEffect(() => {
    if (variant !== 2) return;
    const id = setInterval(
      () => setMarker(50 + 45 * Math.sin((performance.now() - start.current) / 480)),
      30,
    );
    return () => clearInterval(id);
  }, [variant]);
  function hit(x: number, y: number) {
    const target = c.data.targets[index];
    const next = [...errors, Math.hypot(x - target.x, y - target.y)];
    if (index >= 4) done({ errors: next }, performance.now() - start.current);
    else {
      setErrors(next);
      setIndex(index + 1);
    }
  }
  function click(e: React.PointerEvent) {
    if (variant === 2) return;
    const rect = field.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100,
      y = ((e.clientY - rect.top) / rect.height) * 100;
    if (variant === 3) {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setCursor({ x, y });
    } else hit(x, y);
  }
  return (
    <div>
      <div className="motor-readout">
        <span className="mono">
          {variant === 2 ? t('TARGET / CENTER') : t(`CHECKPOINT / ${index + 1} OF 5`)}
        </span>
        <span>{t('Precision instrument')}</span>
      </div>
      <div
        ref={field}
        className={`motor-field ${variant === 3 ? 'drag-field' : ''}`}
        onPointerDown={click}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const rect = field.current!.getBoundingClientRect();
          setCursor({
            x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
            y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
          });
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          const rect = field.current!.getBoundingClientRect();
          hit(
            ((e.clientX - rect.left) / rect.width) * 100,
            ((e.clientY - rect.top) / rect.height) * 100,
          );
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        role="application"
        aria-label={t('Motor precision field')}
        tabIndex={0}
        onKeyDown={(e) => {
          if (variant === 2) return;
          if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            setCursor((p) => ({
              x: Math.min(
                100,
                Math.max(0, p.x + (e.key === 'ArrowRight' ? 2 : e.key === 'ArrowLeft' ? -2 : 0)),
              ),
              y: Math.min(
                100,
                Math.max(0, p.y + (e.key === 'ArrowDown' ? 2 : e.key === 'ArrowUp' ? -2 : 0)),
              ),
            }));
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            hit(cursor.x, cursor.y);
          }
        }}
      >
        {variant === 2 ? (
          <>
            <div className="stop-track">
              <div className="stop-center" />
              <span className="stop-marker" style={{ left: `${marker}%` }} />
            </div>
            <button
              className="btn stop-button"
              onClick={() =>
                done({ errors: [Math.abs(marker - 50)] }, performance.now() - start.current)
              }
            >
              {t('Stop marker')}
            </button>
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="motor-svg"
              aria-hidden="true"
            >
              {variant === 1 && (
                <polyline
                  points={c.data.targets.map((t: any) => `${t.x},${t.y}`).join(' ')}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth=".5"
                  strokeDasharray="1 1"
                />
              )}
            </svg>
            {c.data.targets.map((target: { x: number; y: number }, i: number) => (
              <div
                key={i}
                className={`motor-target ${i === index ? 'current' : i < index ? 'hit' : ''}`}
                style={{
                  left: `${target.x}%`,
                  top: `${target.y}%`,
                  width: c.data.radius * 2,
                  height: c.data.radius * 2,
                }}
              >
                <span>{variant === 1 ? i + 1 : '+'}</span>
              </div>
            ))}
            <div className="keyboard-cursor" style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}>
              ⌖
            </div>
          </>
        )}
      </div>
      <p className="small muted">
        {t(
          'Pointer: tap the target center. Keyboard: focus the field, move with arrows, press Enter. The moving-marker task uses the Stop button.',
        )}
      </p>
    </div>
  );
}
export function MultiInstrument({ challenge: c, done }: { challenge: Challenge; done: Done }) {
  const { t } = useLanguage();

  const [gauge, setGauge] = useState(c.data.initialGauge),
    [alert, setAlert] = useState(false),
    [ack, setAck] = useState(0),
    [answer, setAnswer] = useState(''),
    [remaining, setRemaining] = useState(14);
  const start = useRef(performance.now()),
    sample = useRef({ total: 0, inside: 0 }),
    event = useRef(-1),
    state = useRef({ gauge, ack, answer });
  state.current = { gauge, ack, answer };
  const finish = useRef(done);
  finish.current = done;
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = performance.now() - start.current;
      setRemaining(Math.max(0, Math.ceil((c.data.durationMs - elapsed) / 1000)));
      sample.current.total++;
      if (state.current.gauge >= 35 && state.current.gauge <= 65) sample.current.inside++;
      setGauge((v: number) => Math.max(0, Math.min(100, v + c.data.drift)));
      const latest = c.data.events.filter((v: number) => elapsed >= v).length - 1;
      if (latest > event.current) {
        event.current = latest;
        setAlert(true);
      }
      if (elapsed >= c.data.durationMs) {
        clearInterval(id);
        finish.current(
          {
            answer: Number(state.current.answer),
            alerts: state.current.ack,
            inRange: sample.current.inside / sample.current.total,
          },
          elapsed,
        );
      }
    }, 500);
    return () => clearInterval(id);
  }, [c]);
  return (
    <div className="multi-instrument">
      <div className="instrument-top">
        <span className="mono">{t('OPERATIONS MONITOR / LIVE')}</span>
        <span className="mono">
          {remaining}
          {t('s')}
        </span>
      </div>
      <div className="multi-grid">
        <section>
          <span className="eyebrow">{t('01 / MAINTAIN RANGE')}</span>
          <div className="gauge-track">
            <span className="gauge-zone" />
            <span className="gauge-marker" style={{ left: `${gauge}%` }} />
          </div>
          <div className="gauge-number mono">
            {gauge}
            <span> / 100</span>
          </div>
          <div className="button-row">
            <button
              className="btn secondary"
              onClick={() => setGauge((v: number) => Math.max(0, v - 12))}
            >
              −12
            </button>
            <button
              className="btn secondary"
              onClick={() => setGauge((v: number) => Math.min(100, v + 12))}
            >
              +12
            </button>
          </div>
          <p className="small muted">{t('Maintain 35–65')}</p>
        </section>
        <section>
          <span className="eyebrow">{t('02 / ALERT CHANNEL')}</span>
          <button
            className={`alert-channel ${alert ? 'needs-action' : ''}`}
            disabled={!alert}
            onClick={() => {
              setAck((v) => v + 1);
              setAlert(false);
            }}
          >
            <Icon name="pulse" size={34} />
            <b>{alert ? t('Acknowledge signal') : t('Monitoring')}</b>
            <span>
              {ack} {t(' / 3 acknowledged')}
            </span>
          </button>
        </section>
        <section>
          <span className="eyebrow">{t('03 / CALCULATION')}</span>
          <div className="multi-math mono">
            {c.data.a} + {c.data.b}
          </div>
          <label>
            {t('Answer')}
            <input inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </label>
        </section>
      </div>
    </div>
  );
}
