import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { openDatabase, type Database } from '../server/database.js';
import { createApp } from '../server/app.js';
import { passwordHash } from '../server/auth.js';
import { generate } from '../server/generators.js';
let db: Database, server: Server, base: string;
class Agent {
  cookie = '';
  csrf = '';
  async call(path: string, method = 'GET', body?: any, extra: Record<string, string> = {}) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-cortex-request': '1',
        cookie: this.cookie,
        ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) this.cookie = cookies.map((c) => c.split(';')[0]).join('; ');
    const data = await response.json();
    return { status: response.status, data, headers: response.headers };
  }
  async login() {
    const r = await this.call('/admin/login', 'POST', {
      username: 'test-operator',
      password: 'test-only-password',
    });
    assert.equal(r.status, 200);
    this.csrf = r.data.csrf;
    return r;
  }
}
before(async () => {
  db = await openDatabase(process.env.TEST_DATABASE_URL || 'sqlite::memory:');
  const app = createApp(db, {
    origin: 'http://localhost',
    secret: 'test-only-session-secret-32-characters',
    username: 'test-operator',
    passwordHash: await passwordHash('test-only-password'),
    production: false,
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
});
test('participant session autosaves, pauses, resumes, grades, completes and releases', async () => {
  const a = new Agent();
  let r = await a.call('/sessions', 'POST', {
    alias: 'Unit subject',
    mode: 'custom',
    custom: { moduleIds: ['logic'], rounds: 2 },
  });
  assert.equal(r.status, 201);
  const s = r.data;
  assert.ok(!('override' in s));
  assert.ok(!('metrics' in s));
  assert.match(a.cookie, /cortex_participant=/);
  assert.equal((await a.call('/session/state', 'POST', { paused: true })).data.status, 'paused');
  assert.equal((await a.call('/session/challenge')).status, 409);
  assert.equal((await a.call('/session/state', 'POST', { paused: false })).data.status, 'active');
  for (let index = 0; index < 2; index++) {
    const challenge = await a.call('/session/challenge');
    assert.equal(challenge.status, 200);
    assert.ok(!('answer' in challenge.data));
    const expected = generate(s.seed, s.plan, index, 2).answer;
    const body = { index, value: expected, elapsedMs: 1200, confidence: 100 };
    r = await a.call('/session/answer', 'POST', body);
    assert.equal(r.status, 200);
    assert.equal(r.data.cursor, index + 1);
    const retry = await a.call('/session/answer', 'POST', body);
    assert.equal(retry.data.cursor, index + 1);
  }
  assert.equal(r.data.status, 'complete');
  const result = await a.call('/session/results');
  assert.equal(result.data.displayed.accuracy, 100);
  assert.equal(result.data.revealed, true);
  assert.equal(result.data.real.accuracy, 100);
  assert.equal((await a.call('/session')).data.cursor, 2);
});
test('admin profile → invite → hold → override → release → reveal preserves real performance', async () => {
  const admin = new Agent();
  await admin.login();
  const p = await admin.call('/admin/profiles', 'POST', {
    name: 'Disaster fixture',
    override: {
      mode: 'manual',
      values: { index: 7, classification: 'Fixture override', categories: { logic: 2 } },
    },
    release: 'hold',
    reveal: 'manual',
    revealDelaySeconds: 1,
  });
  assert.equal(p.status, 201);
  const inv = await admin.call('/admin/invites', 'POST', {
    profileId: p.data.id,
    maxUses: 1,
    expiresDays: 1,
  });
  assert.equal(inv.status, 201);
  const participant = new Agent();
  const started = await participant.call('/sessions', 'POST', {
    alias: 'Invite subject',
    mode: 'custom',
    invite: inv.data.url.split('/').at(-1),
    custom: { moduleIds: ['logic'], rounds: 1 },
  });
  assert.equal(started.status, 201);
  assert.ok(!JSON.stringify(started.data).includes('Fixture override'));
  const s = started.data;
  await participant.call('/session/challenge');
  const expected = generate(s.seed, s.plan, 0, 2).answer;
  await participant.call('/session/answer', 'POST', {
    index: 0,
    value: expected,
    elapsedMs: 1200,
    confidence: 100,
  });
  assert.equal((await participant.call('/session/results')).data.held, true);
  const details = await admin.call(`/admin/sessions/${s.id}`);
  assert.equal(details.data.metrics.accuracy, 100);
  assert.equal(details.data.override.values.index, 7);
  assert.equal(
    (
      await admin.call(`/admin/sessions/${s.id}`, 'PATCH', {
        override: { mode: 'manual', values: { index: 13, percentile: 0.4 } },
      })
    ).status,
    200,
  );
  assert.equal((await admin.call(`/admin/sessions/${s.id}/release`, 'POST', {})).status, 200);
  const released = await participant.call('/session/results');
  assert.equal(released.data.displayed.index, 13);
  assert.equal(released.data.real, undefined);
  assert.equal(released.data.revealed, false);
  await admin.call(`/admin/sessions/${s.id}/reveal`, 'POST', {});
  const revealed = await participant.call('/session/results');
  assert.equal(revealed.data.real.index, 1000);
  assert.equal(revealed.data.displayed.index, 13);
  assert.equal(revealed.data.revealed, true);
  const repeat = new Agent();
  assert.equal(
    (
      await repeat.call('/sessions', 'POST', {
        alias: 'Duplicate invite',
        mode: 'quick',
        invite: inv.data.url.split('/').at(-1),
      })
    ).status,
    400,
  );
  const audit = await admin.call('/admin/audit');
  assert.ok(audit.data.some((a: any) => a.action === 'reveal.triggered'));
});
test('admin auth, origin, CSRF, validation and isolation are enforced', async () => {
  const outsider = new Agent();
  assert.equal((await outsider.call('/admin/sessions')).status, 401);
  assert.equal((await outsider.call('/session')).status, 401);
  assert.equal(
    (
      await outsider.call(
        '/sessions',
        'POST',
        { alias: 'unsafe', mode: 'quick' },
        { origin: 'https://attacker.example' },
      )
    ).status,
    403,
  );
  assert.equal(
    (await outsider.call('/sessions', 'POST', { alias: '', mode: 'quick' })).status,
    400,
  );
  assert.equal(
    (await outsider.call('/admin/login', 'POST', { username: 'test-operator', password: 'bad' }))
      .status,
    401,
  );
  const admin = new Agent();
  await admin.login();
  admin.csrf = 'invalid';
  assert.equal((await admin.call('/admin/profiles', 'POST', {})).status, 403);
  const participant = new Agent();
  await participant.call('/sessions', 'POST', {
    alias: '<script>alert(1)</script>',
    mode: 'quick',
  });
  assert.equal((await participant.call('/admin/presets')).status, 401);
  assert.equal(
    (await participant.call('/sessions', 'POST', { alias: 'duplicate', mode: 'quick' })).status,
    409,
  );
  assert.equal(
    (
      await participant.call('/session/answer', 'POST', {
        index: 0,
        value: 'invalid',
        elapsedMs: -2,
        confidence: 100,
      })
    ).status,
    400,
  );
});
test('concurrent answer retries advance exactly once', async () => {
  const a = new Agent();
  const created = await a.call('/sessions', 'POST', {
    alias: 'Concurrent subject',
    mode: 'custom',
    custom: { moduleIds: ['logic'], rounds: 2 },
  });
  const s = created.data;
  await a.call('/session/challenge');
  const body = {
    index: 0,
    value: generate(s.seed, s.plan, 0, 2).answer,
    elapsedMs: 500,
    confidence: 70,
  };
  const [first, second] = await Promise.all([
    a.call('/session/answer', 'POST', body),
    a.call('/session/answer', 'POST', body),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal((await a.call('/session')).data.cursor, 1);
  const rows = await db.query('SELECT trial FROM responses WHERE session_id=?', [s.id]);
  assert.equal(rows.length, 1);
});
test('login rate limiting persists in the database', async () => {
  await db.query('DELETE FROM login_limits');
  const a = new Agent();
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await a.call('/admin/login', 'POST', { username: 'test-operator', password: 'wrong' }))
        .status,
      401,
    );
  assert.equal(
    (
      await a.call('/admin/login', 'POST', {
        username: 'test-operator',
        password: 'test-only-password',
      })
    ).status,
    429,
  );
  await db.query('DELETE FROM login_limits');
});
