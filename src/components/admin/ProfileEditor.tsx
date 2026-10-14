import { useState } from 'react';
import type { Profile, Override, Metrics } from '../../../shared/model';
import { modules } from '../../../shared/modules';
import { ErrorNote } from '../Chrome';
const scalarKeys: (keyof Metrics)[] = [
  'index',
  'percentile',
  'accuracy',
  'medianReactionMs',
  'reactionVariance',
  'falseStartRate',
  'memorySpan',
  'switchCostMs',
  'precision',
  'completion',
  'calibration',
  'consistency',
  'fatigue',
  'wpm',
  'corrections',
];
export default function ProfileEditor({
  initial,
  presets,
  onSave,
  onCancel,
  session = false,
}: {
  initial: Profile;
  presets: Record<string, Override>;
  onSave: (p: Profile) => Promise<void>;
  onCancel: () => void;
  session?: boolean;
}) {
  const [p, setP] = useState(initial),
    [raw, setRaw] = useState(JSON.stringify(initial.override.values, null, 2)),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [advanced, setAdvanced] = useState(false);
  function change(values: Partial<Metrics>) {
    const next = { ...p.override.values, ...values };
    setP({ ...p, override: { ...p.override, values: next } });
    setRaw(JSON.stringify(next, null, 2));
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const final = {
        ...p,
        override: { ...p.override, values: advanced ? JSON.parse(raw) : p.override.values },
      };
      await onSave(final);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor panel">
      <div className="panel-heading">
        <h2>
          {session
            ? 'Session result configuration'
            : p.id
              ? 'Edit result profile'
              : 'Create result profile'}
        </h2>
        <button className="text-btn" onClick={onCancel}>
          Close ✕
        </button>
      </div>
      <ErrorNote error={error} />
      {!session && (
        <label>
          Profile name
          <input
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
            maxLength={80}
          />
        </label>
      )}
      <div className="form-grid">
        <label>
          Result mode
          <select
            value={p.override.mode}
            onChange={(e) =>
              setP({ ...p, override: { ...p.override, mode: e.target.value as Override['mode'] } })
            }
          >
            <option value="real">A — Real calculated results</option>
            <option value="manual">B — Manual override</option>
            <option value="preset">C — Prank preset</option>
            <option value="scripted">D — Custom scripted result</option>
          </select>
        </label>
        <label>
          Load preset
          <select
            defaultValue=""
            onChange={(e) => {
              const override = structuredClone(presets[e.target.value]);
              if (override) {
                setP({ ...p, override });
                setRaw(JSON.stringify(override.values, null, 2));
              }
            }}
          >
            <option value="">Select a starting point</option>
            {Object.keys(presets).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      {p.override.mode !== 'real' && (
        <>
          <div className="form-grid scalars">
            {scalarKeys.map((key) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, ' $1')}
                <input
                  type="number"
                  value={(p.override.values[key] as number) ?? ''}
                  placeholder="Use real value"
                  onChange={(e) => {
                    const v = { ...p.override.values };
                    if (e.target.value === '') delete v[key];
                    else (v as any)[key] = Number(e.target.value);
                    setP({ ...p, override: { ...p.override, values: v } });
                    setRaw(JSON.stringify(v, null, 2));
                  }}
                />
              </label>
            ))}
          </div>
          <h3>Dimension scores / 100</h3>
          <div className="form-grid scalars">
            {modules.map((m) => (
              <label key={m.id}>
                {m.name}
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={p.override.values.categories?.[m.id] ?? ''}
                  placeholder="Use real value"
                  onChange={(e) => {
                    const categories = { ...p.override.values.categories };
                    if (e.target.value === '') delete categories[m.id];
                    else categories[m.id] = Number(e.target.value);
                    change({ categories });
                  }}
                />
              </label>
            ))}
          </div>
          <label>
            Final classification
            <input
              value={p.override.values.classification || ''}
              onChange={(e) => change({ classification: e.target.value })}
              maxLength={200}
            />
          </label>
          <label>
            Recommendation
            <textarea
              value={p.override.values.recommendation || ''}
              onChange={(e) => change({ recommendation: e.target.value })}
              maxLength={3000}
            />
          </label>
          <div className="form-grid">
            <label>
              Strengths (one per line)
              <textarea
                value={p.override.values.strengths?.join('\n') || ''}
                onChange={(e) => change({ strengths: e.target.value.split('\n').filter(Boolean) })}
              />
            </label>
            <label>
              Weaknesses (one per line)
              <textarea
                value={p.override.values.weaknesses?.join('\n') || ''}
                onChange={(e) => change({ weaknesses: e.target.value.split('\n').filter(Boolean) })}
              />
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={advanced}
              onChange={(e) => setAdvanced(e.target.checked)}
            />
            Advanced scripted values (JSON: labels, chart values, all metrics)
          </label>
          {advanced && (
            <label>
              Override values JSON
              <textarea
                className="json-editor mono"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                spellCheck={false}
              />
            </label>
          )}
        </>
      )}
      <h3>Release & disclosure</h3>
      <div className="form-grid">
        <label>
          Result release
          <select
            value={p.release}
            onChange={(e) => setP({ ...p, release: e.target.value as Profile['release'] })}
          >
            <option value="hold">Hold for operator review</option>
            <option value="auto">Release on completion</option>
          </select>
        </label>
        <label>
          Prank reveal
          <select
            value={p.reveal}
            onChange={(e) => setP({ ...p, reveal: e.target.value as Profile['reveal'] })}
          >
            <option value="immediate">Immediately after release</option>
            <option value="delay">After a configurable delay</option>
            <option value="manual">Operator controlled</option>
            <option value="disabled">Temporarily disabled</option>
          </select>
        </label>
        {p.reveal === 'delay' && (
          <label>
            Delay (seconds, up to 86400)
            <input
              type="number"
              min="0"
              max="86400"
              value={p.revealDelaySeconds}
              onChange={(e) => setP({ ...p, revealDelaySeconds: Number(e.target.value) })}
            />
          </label>
        )}
      </div>
      <p className="small muted">
        Every released result receives a final disclosure within 24 hours, including manual and
        temporarily disabled modes. Genuine responses remain preserved.
      </p>
      <div className="button-row">
        <button className="btn" disabled={busy || (!session && !p.name.trim())} onClick={save}>
          {busy ? 'Saving…' : 'Save configuration'}
        </button>
        <button className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
