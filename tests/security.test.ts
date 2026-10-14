import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';
import { passwordHash, digest } from '../server/auth.js';
import { generate } from '../server/generators.js';
test('secure cookies, headers, credential rotation and changed reveal timing are enforced', async () => {
  const db = await openDatabase('sqlite::memory:');
  const config = {
    origin: 'https://cortex.example',
    secret: 'security-test-secret-32-characters',
    username: 'test-operator',
    passwordHash: await passwordHash('test-only-password'),
    production: true,
  };
  let server = createApp(db, config).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  let base = `http://127.0.0.1:${(server.address() as any).port}`;
  async function call(path: string, method = 'GET', body?: any, cookie = '', csrf = '') {
    const response = await fetch(base + '/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-cortex-request': '1',
        origin: config.origin,
        cookie,
        'x-csrf-token': csrf,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  try {
    const login = await call('/admin/login', 'POST', {
      username: config.username,
      password: 'test-only-password',
    });
    assert.equal(login.status, 200);
    const header = login.headers.get('set-cookie')!;
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Strict/);
    const adminCookie = header.split(';')[0],
      csrf = login.data.csrf;
    assert.match(login.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
    assert.match(login.headers.get('strict-transport-security')!, /max-age/);
    const profile = await call(
      '/admin/profiles',
      'POST',
      {
        name: 'Timing fixture',
        override: { mode: 'manual', values: { index: 7 } },
        release: 'auto',
        reveal: 'manual',
        revealDelaySeconds: 60,
      },
      adminCookie,
      csrf,
    );
    const invite = await call(
      '/admin/invites',
      'POST',
      { profileId: profile.data.id },
      adminCookie,
      csrf,
    );
    const expired = await call(
      '/admin/invites',
      'POST',
      { profileId: profile.data.id },
      adminCookie,
      csrf,
    );
    await db.query('UPDATE invites SET expires_at=? WHERE token_hash=?', [
      new Date(Date.now() - 1000).toISOString(),
      digest(expired.data.url.split('/').at(-1), config.secret),
    ]);
    assert.equal(
      (
        await call('/sessions', 'POST', {
          alias: 'Expired fixture',
          mode: 'quick',
          invite: expired.data.url.split('/').at(-1),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call('/sessions', 'POST', {
          alias: 'Invalid fixture',
          mode: 'quick',
          invite: 'not-a-token',
        })
      ).status,
      400,
    );
    const created = await call('/sessions', 'POST', {
      alias: 'Timing subject',
      mode: 'custom',
      custom: { moduleIds: ['logic'], rounds: 1 },
      invite: invite.data.url.split('/').at(-1),
    });
    const s = created.data,
      cookie = created.headers.get('set-cookie')!.split(';')[0];
    await call('/session/challenge', 'GET', undefined, cookie);
    await call(
      '/session/answer',
      'POST',
      { index: 0, value: generate(s.seed, s.plan, 0, 2).answer, elapsedMs: 1000, confidence: 100 },
      cookie,
    );
    const before = await call('/session/results', 'GET', undefined, cookie);
    assert.equal(before.data.revealed, false);
    assert.equal(before.data.real, undefined);
    assert.ok(Date.parse(before.data.revealAt) - Date.now() <= 86400000);
    await call(
      `/admin/sessions/${s.id}`,
      'PATCH',
      { revealMode: 'delay', revealDelaySeconds: 0 },
      adminCookie,
      csrf,
    );
    assert.equal((await call('/session/results', 'GET', undefined, cookie)).data.revealed, true);
    // Final disclosure cannot be made hidden again after the participant has access.
    await call(`/admin/sessions/${s.id}`, 'PATCH', { revealMode: 'disabled' }, adminCookie, csrf);
    assert.equal((await call('/session/results', 'GET', undefined, cookie)).data.revealed, true);
    const anonymous = await call('/context');
    assert.equal(anonymous.status, 200);
    assert.deepEqual(anonymous.data, {});
    assert.equal((await call('/context', 'GET', undefined, cookie)).data.participant.id, s.id);
    const hashed = (
      await db.query('SELECT token_hash FROM auth_sessions WHERE role=?', ['admin'])
    )[0].token_hash;
    assert.equal(hashed, digest(adminCookie.split('=')[1], config.secret));
    assert.notEqual(hashed, adminCookie.split('=')[1]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    config.passwordHash = await passwordHash('replacement-test-password');
    server = createApp(db, config).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
    assert.equal((await call('/admin/me', 'GET', undefined, adminCookie)).status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
