import { useEffect, useState } from 'react';
import { api, navigate, setCsrf } from '../api';
import type { Profile, Override, Participant, Metrics } from '../../shared/model';
import { Shell, PageHead, Badge, Icon, ErrorNote, Brand } from '../components/Chrome';
import ProfileEditor from '../components/admin/ProfileEditor';
import { Timeline, Radar } from '../components/Charts';
const pages = [
  'Dashboard',
  'Sessions',
  'Active Sessions',
  'Result Profiles',
  'Invite Links',
  'Preset Editor',
  'Results',
  'Reveal Controls',
  'System Status',
];
const slug = (label: string) => label.toLowerCase().replaceAll(' ', '-');
const blank: Profile = {
  id: '',
  name: '',
  override: { mode: 'manual', values: {} },
  release: 'hold',
  reveal: 'manual',
  revealDelaySeconds: 30,
};
type AdminSession = Participant & {
  override: Override;
  releaseMode: Profile['release'];
  revealMode: Profile['reveal'];
  revealDelaySeconds: number;
  metrics?: Metrics;
  displayed?: Metrics;
  responses?: any[];
  trajectory?: any[];
};
export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false),
    [loading, setLoading] = useState(true),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [active, setActive] = useState(
      pages.find((p) => slug(p) === location.pathname.split('/')[2]) || 'Dashboard',
    ),
    [sessions, setSessions] = useState<AdminSession[]>([]),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [presets, setPresets] = useState<Record<string, Override>>({}),
    [q, setQ] = useState(''),
    [status, setStatus] = useState('all'),
    [selected, setSelected] = useState<AdminSession>(),
    [editor, setEditor] = useState<Profile>(),
    [sessionEditor, setSessionEditor] = useState(false),
    [invite, setInvite] = useState(''),
    [inviteProfile, setInviteProfile] = useState(''),
    [inviteUses, setInviteUses] = useState(1),
    [inviteDays, setInviteDays] = useState(7),
    [invites, setInvites] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [system, setSystem] = useState<any>(),
    [message, setMessage] = useState('');
  useEffect(() => {
    api('/context')
      .then((data) => {
        if (!data.operator) return;
        setCsrf(data.operator.csrf);
        setAuthenticated(true);
        setUsername(data.operator.username);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  async function refresh() {
    const [ss, ps, pr, iv, au, sy] = await Promise.all([
      api<AdminSession[]>(
        `/admin/sessions?q=${encodeURIComponent(q)}&status=${active === 'Active Sessions' ? 'active' : status}`,
      ),
      api<Profile[]>('/admin/profiles'),
      api('/admin/presets'),
      api('/admin/invites'),
      api('/admin/audit'),
      api('/admin/status'),
    ]);
    setSessions(ss);
    setProfiles(ps);
    setPresets(pr);
    setInvites(iv);
    setAudit(au);
    setSystem(sy);
  }
  useEffect(() => {
    const sync = () => {
      setActive(pages.find((p) => slug(p) === location.pathname.split('/')[2]) || 'Dashboard');
      setSelected(undefined);
      setEditor(undefined);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    const update = () =>
      refresh().catch((e) => {
        if (alive) setError(e.message);
      });
    void update();
    const interval = setInterval(() => {
      void update();
      if (selected?.id)
        api<AdminSession>(`/admin/sessions/${selected.id}`)
          .then((s) => {
            if (alive) setSelected(s);
          })
          .catch(() => {});
    }, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [authenticated, q, status, active, selected?.id]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/admin/login', 'POST', { username, password });
      setCsrf(data.csrf);
      setPassword('');
      setAuthenticated(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const onNav = (label: string) => {
    setActive(label);
    setSelected(undefined);
    setEditor(undefined);
    setError('');
    navigate(`/admin/${slug(label)}`);
  };
  async function select(id: string) {
    setError('');
    try {
      setSelected(await api(`/admin/sessions/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function action(kind: 'release' | 'reveal') {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/sessions/${selected.id}/${kind}`, 'POST', {});
      await select(selected.id);
      await refresh();
      setMessage(
        kind === 'release' ? 'Results released to the participant.' : 'Prank disclosure activated.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(p: Profile) {
    if (sessionEditor && selected) {
      await api(`/admin/sessions/${selected.id}`, 'PATCH', {
        override: p.override,
        releaseMode: p.release,
        revealMode: p.reveal,
        revealDelaySeconds: p.revealDelaySeconds,
      });
      await select(selected.id);
    } else
      await api(p.id ? `/admin/profiles/${p.id}` : '/admin/profiles', p.id ? 'PATCH' : 'POST', {
        name: p.name,
        override: p.override,
        release: p.release,
        reveal: p.reveal,
        revealDelaySeconds: p.revealDelaySeconds,
      });
    setEditor(undefined);
    setSessionEditor(false);
    await refresh();
    setMessage('Configuration saved. Real performance is preserved.');
  }
  async function createInvite() {
    setError('');
    setBusy(true);
    try {
      const data = await api('/admin/invites', 'POST', {
        profileId: inviteProfile,
        maxUses: inviteUses,
        expiresDays: inviteDays,
      });
      setInvite(data.url);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <div className="loading">Authenticating operator…</div>;
  if (!authenticated)
    return (
      <div className="login-page">
        <div className="login-brand">
          <Brand />
          <span className="mono small">OPERATOR CONSOLE / RESTRICTED</span>
        </div>
        <form onSubmit={login} className="login-panel">
          <div className="eyebrow">AUTHORIZED OPERATORS</div>
          <h1>Laboratory access.</h1>
          <p>Sign in to manage protocols, sessions, and result profiles.</p>
          <ErrorNote error={error} />
          <label>
            Operator username
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            Operator password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="btn" disabled={busy}>
            {busy ? 'Verifying credentials…' : 'Access console'}
            <Icon name="arrow" />
          </button>
          <p className="small muted">
            Credentials are configured by the host. There is no default password.
          </p>
          <a
            className="text-btn"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            ← Participant workspace
          </a>
        </form>
        <div className="login-footer mono">CORTEX / CONTROL PLANE 01</div>
      </div>
    );
  const completed = sessions.filter((s) => s.status === 'complete'),
    held = completed.filter((s) => !s.released),
    live = sessions.filter((s) => s.status === 'active');
  return (
    <Shell admin active={active} onNav={onNav}>
      <PageHead
        eyebrow="CORTEX / OPERATOR CONTROL PLANE"
        title={active === 'Dashboard' ? 'Laboratory overview.' : active}
        description={
          active === 'Dashboard'
            ? 'Monitor the battery. Shape the report. Control the reveal.'
            : 'Genuine performance stays preserved. Displayed results are operator controlled.'
        }
        action={
          <button
            className="btn secondary"
            onClick={async () => {
              await api('/admin/logout', 'POST', {});
              setCsrf('');
              setAuthenticated(false);
            }}
          >
            Sign out · {username}
          </button>
        }
      />
      <ErrorNote error={error} />
      {message && (
        <div role="status" className="notice">
          {message}
          <button className="text-btn" onClick={() => setMessage('')}>
            Dismiss
          </button>
        </div>
      )}
      {editor ? (
        <ProfileEditor
          key={editor.id + String(sessionEditor)}
          initial={editor}
          presets={presets}
          onSave={save}
          onCancel={() => {
            setEditor(undefined);
            setSessionEditor(false);
          }}
          session={sessionEditor}
        />
      ) : selected ? (
        <>
          <div className="detail-nav">
            <button className="text-btn" onClick={() => setSelected(undefined)}>
              ← All sessions
            </button>
            <Badge tone={selected.status === 'active' ? 'green' : 'neutral'}>
              {selected.status}
            </Badge>
            <span className="mono small">{selected.id}</span>
          </div>
          <div className="panel session-summary">
            <div>
              <h2>{selected.alias}</h2>
              <p>
                {selected.mode} · {new Date(selected.startedAt).toLocaleString()}
              </p>
              <p className="mono small">SEED {selected.seed}</p>
            </div>
            <div className="comparison-score mono">
              {Math.round((selected.cursor / selected.total) * 100)}
              <span>% complete</span>
            </div>
          </div>
          <div className="metric-strip">
            <section>
              <span className="eyebrow">REAL INDEX</span>
              <b className="mono">{selected.metrics?.index ?? '—'}</b>
            </section>
            <section>
              <span className="eyebrow">DISPLAYED INDEX</span>
              <b className="mono">
                {selected.displayed?.index ?? selected.override.values.index ?? 'Real'}
              </b>
            </section>
            <section>
              <span className="eyebrow">RESULT MODE</span>
              <b>{selected.override.mode}</b>
            </section>
            <section>
              <span className="eyebrow">RELEASE</span>
              <b>{selected.released ? 'Released' : 'Held / pending'}</b>
            </section>
          </div>
          <div className="button-row detail-actions">
            <button
              className="btn secondary"
              onClick={() => {
                setSessionEditor(true);
                setEditor({
                  id: selected.id,
                  name: selected.alias,
                  override: selected.override,
                  release: selected.releaseMode,
                  reveal: selected.revealMode,
                  revealDelaySeconds: selected.revealDelaySeconds,
                });
              }}
            >
              Configure displayed result
            </button>
            <button
              className="btn"
              disabled={busy || selected.status !== 'complete' || selected.released}
              onClick={() => action('release')}
            >
              Release results
            </button>
            <button
              className="btn secondary"
              disabled={busy || !selected.released || selected.revealed}
              onClick={() => action('reveal')}
            >
              Trigger prank reveal
            </button>
          </div>
          {selected.metrics && (
            <div className="results-grid">
              <section className="panel">
                <h3>Genuine performance timeline</h3>
                <Timeline metrics={selected.metrics} />
              </section>
              <section className="panel">
                <h3>Real dimension profile</h3>
                <Radar metrics={selected.metrics} />
              </section>
            </div>
          )}
          <div className="panel">
            <div className="panel-heading">
              <h3>Recent answers</h3>
              <Badge>Live · refreshes every 5s</Badge>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Trial</th>
                    <th>Module</th>
                    <th>Accuracy</th>
                    <th>Time</th>
                    <th>Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.responses?.map((r) => (
                    <tr key={r.index}>
                      <td>{r.index + 1}</td>
                      <td>{r.moduleId}</td>
                      <td>{Math.round(r.score * 100)}%</td>
                      <td className="mono">{Math.round(r.elapsedMs)} ms</td>
                      <td>{r.difficulty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <details className="panel">
            <summary>Full genuine metrics & difficulty trajectory</summary>
            <pre className="mono json-output">
              {JSON.stringify(
                {
                  metrics: selected.metrics,
                  trajectory: selected.trajectory,
                  focusLosses: (selected as any).focusLosses,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      ) : (
        <>
          {active === 'Dashboard' && (
            <>
              <div className="admin-stats">
                {[
                  ['Total sessions', sessions.length, 'Current query · up to 200'],
                  ['Live instruments', live.length, 'Actively in the battery'],
                  ['Awaiting release', held.length, 'Completed & held'],
                  ['Result profiles', profiles.length, 'Prepared for assignment'],
                ].map(([label, num, desc]) => (
                  <section className="panel" key={label as string}>
                    <span className="eyebrow">{label}</span>
                    <b className="mono">{num}</b>
                    <p>{desc}</p>
                  </section>
                ))}
              </div>
              <section className="operator-callout">
                <div>
                  <span className="eyebrow">PREPARE THE EXPERIMENT</span>
                  <h2>
                    A genuine test.
                    <br />A very specific conclusion.
                  </h2>
                  <p>
                    Create a result profile, then assign it through a unique invite. You control
                    release and disclosure.
                  </p>
                </div>
                <button
                  className="btn light"
                  onClick={() => {
                    setActive('Result Profiles');
                    setEditor(structuredClone(blank));
                  }}
                >
                  Create result profile <Icon name="arrow" />
                </button>
              </section>
            </>
          )}
          {['Dashboard', 'Sessions', 'Active Sessions', 'Results', 'Reveal Controls'].includes(
            active,
          ) && (
            <section className="panel sessions-panel">
              <div className="panel-heading">
                <h3>{active === 'Dashboard' ? 'Recent sessions' : 'Session directory'}</h3>
                <Badge>5s refresh</Badge>
              </div>
              <div className="filters">
                <label>
                  Search alias
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Find a participant…"
                  />
                </label>
                <label>
                  Status
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="complete">Complete</option>
                  </select>
                </label>
              </div>
              {!sessions.length ? (
                <div className="empty">
                  <Icon name="people" size={36} />
                  <h3>No sessions yet.</h3>
                  <p>Create an invite or start a participant battery to populate the laboratory.</p>
                  <button className="btn secondary" onClick={() => onNav('Invite Links')}>
                    Prepare an invite
                  </button>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Participant / session</th>
                        <th>Protocol</th>
                        <th>Progress</th>
                        <th>Real</th>
                        <th>Displayed</th>
                        <th>State</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <b>{s.alias}</b>
                            <small className="mono">
                              {s.id.slice(0, 8)} · {new Date(s.startedAt).toLocaleDateString()}
                            </small>
                          </td>
                          <td>{s.mode}</td>
                          <td>
                            <span className="mono">{Math.round((s.cursor / s.total) * 100)}%</span>
                            <small>
                              {s.cursor}/{s.total} trials
                            </small>
                          </td>
                          <td className="mono">{s.metrics?.index ?? '—'}</td>
                          <td className="mono">
                            {s.displayed?.index ?? s.override.values.index ?? 'Real'}
                          </td>
                          <td>
                            <Badge
                              tone={
                                s.status === 'active'
                                  ? 'green'
                                  : s.status === 'complete' && !s.released
                                    ? 'amber'
                                    : 'neutral'
                              }
                            >
                              {s.status === 'complete'
                                ? s.released
                                  ? 'Released'
                                  : 'Held'
                                : s.status}
                            </Badge>
                            {s.override.mode !== 'real' && <small>Override active</small>}
                          </td>
                          <td>
                            <button
                              className="text-btn"
                              aria-label={`Open session ${s.alias}`}
                              onClick={() => select(s.id)}
                            >
                              Open ↗
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {['Result Profiles', 'Preset Editor'].includes(active) && (
            <>
              <div className="section-heading">
                <h2>
                  {active === 'Preset Editor'
                    ? 'Editable preset library'
                    : 'Prepared result profiles'}
                </h2>
                <button
                  className="btn"
                  onClick={() => {
                    setSessionEditor(false);
                    setEditor(structuredClone(blank));
                  }}
                >
                  Create profile +
                </button>
              </div>
              {active === 'Preset Editor' && (
                <div className="preset-grid">
                  {Object.entries(presets).map(([name, override]) => (
                    <section className="panel" key={name}>
                      <Badge>STARTING TEMPLATE</Badge>
                      <h3>{name}</h3>
                      <b className="preset-score mono">
                        {override.values.index}
                        <small> / 1000</small>
                      </b>
                      <p>{override.values.recommendation}</p>
                      <button
                        className="btn secondary"
                        onClick={() => {
                          setSessionEditor(false);
                          setEditor({
                            ...structuredClone(blank),
                            name,
                            override: structuredClone(override),
                          });
                        }}
                      >
                        Customize & save
                      </button>
                    </section>
                  ))}
                </div>
              )}
              <section className="panel">
                {!profiles.length ? (
                  <div className="empty">
                    <Icon name="file" size={36} />
                    <h3>Prepare the ending first.</h3>
                    <p>Profiles attach privately to sessions created through your invites.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Profile</th>
                          <th>Result mode</th>
                          <th>Index</th>
                          <th>Release</th>
                          <th>Reveal</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {profiles.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <b>{p.name}</b>
                            </td>
                            <td>{p.override.mode}</td>
                            <td className="mono">{p.override.values.index ?? 'Real'}</td>
                            <td>{p.release}</td>
                            <td>{p.reveal}</td>
                            <td>
                              <button
                                className="text-btn"
                                onClick={() => {
                                  setSessionEditor(false);
                                  setEditor(structuredClone(p));
                                }}
                              >
                                Edit ↗
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <p className="small muted">
                Editing a profile affects future invite sessions. Configure an existing session
                explicitly to change its displayed result.
              </p>
            </>
          )}
          {active === 'Invite Links' && (
            <>
              <section className="panel invite-panel">
                <div className="eyebrow">PRIVATE PROFILE ASSIGNMENT</div>
                <h2>Give the experiment an entrance.</h2>
                <p>One cryptographically random link. No profile details exposed before release.</p>
                <div className="form-grid">
                  <label>
                    Result profile
                    <select
                      value={inviteProfile}
                      onChange={(e) => setInviteProfile(e.target.value)}
                    >
                      <option value="">Select a profile</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Maximum uses
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={inviteUses}
                      onChange={(e) => setInviteUses(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Expires in days
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={inviteDays}
                      onChange={(e) => setInviteDays(Number(e.target.value))}
                    />
                  </label>
                </div>
                <button className="btn" disabled={busy || !inviteProfile} onClick={createInvite}>
                  Generate unique invite <Icon name="link" />
                </button>
                {invite && (
                  <div className="generated-invite">
                    <label>
                      Friend’s invite URL
                      <input readOnly value={invite} onFocus={(e) => e.target.select()} />
                    </label>
                    <button
                      className="btn secondary"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(invite)
                          .then(() => setMessage('Invite copied.'))
                          .catch(() => setMessage('Select and copy the URL manually.'))
                      }
                    >
                      Copy link
                    </button>
                    <p className="small muted">
                      Copy now. Only its hash is stored; the original cannot be retrieved.
                    </p>
                  </div>
                )}
              </section>
              <section className="panel">
                <h3>Issued invites</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Profile</th>
                        <th>Created</th>
                        <th>Expires</th>
                        <th>Uses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((v, i) => (
                        <tr key={i}>
                          <td>{v.name}</td>
                          <td>{new Date(v.created_at).toLocaleString()}</td>
                          <td>{new Date(v.expires_at).toLocaleString()}</td>
                          <td>
                            {v.uses}/{v.max_uses}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {['Dashboard', 'System Status'].includes(active) && (
            <section className="panel">
              <div className="panel-heading">
                <h3>
                  {active === 'Dashboard' ? 'Operator activity' : 'System status & audit trail'}
                </h3>
                <Badge tone="green">Database connected</Badge>
              </div>
              {active === 'System Status' && (
                <dl className="metrics-dl">
                  {Object.entries(system || {}).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd className="mono">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="audit-list">
                {audit.length ? (
                  audit.slice(0, active === 'Dashboard' ? 6 : 100).map((a, i) => (
                    <div key={i}>
                      <span className="mono small">
                        {new Date(a.created_at).toLocaleTimeString()}
                      </span>
                      <b>{a.action}</b>
                      <span className="mono small muted">{a.subject.slice(0, 18)}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No operator actions recorded.</p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </Shell>
  );
}
