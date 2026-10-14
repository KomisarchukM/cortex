import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import type { Database } from './database.js';
import { digest, token, validToken, verifyPassword } from './auth.js';
import { generate } from './generators.js';
import { calculate, grade, presets, resolve } from './scoring.js';
import { makePlan, locate, nextDifficulty, modules, schemaVersion } from '../shared/modules.js';
import type {
  Participant,
  Profile,
  Override,
  Metrics,
  ResponseRecord,
  Mode,
} from '../shared/model.js';
export interface Config {
  origin: string;
  secret: string;
  username: string;
  passwordHash: string;
  production: boolean;
  secureCookies?: boolean;
  trustProxy?: boolean;
}
interface Session extends Participant {
  version: number;
  override: Override;
  releaseMode: 'auto' | 'hold';
  revealMode: Profile['reveal'];
  revealDelaySeconds: number;
  releasedAt?: string;
  revealAt?: string;
  displayed?: Metrics;
  trajectory: { trial: number; difficulty: number }[];
  issuedAt?: number;
  focusLosses: number;
}
const now = () => new Date().toISOString();
const score = z.number().min(0).max(100);
const values = z
  .object({
    index: z.number().min(0).max(1000).optional(),
    percentile: z.number().min(0).max(100).optional(),
    accuracy: score.optional(),
    medianReactionMs: z.number().min(0).max(600000).optional(),
    reactionVariance: z.number().min(0).max(1e12).optional(),
    falseStartRate: score.optional(),
    memorySpan: z.number().min(0).max(100).optional(),
    switchCostMs: z.number().min(0).max(600000).optional(),
    precision: score.optional(),
    completion: score.optional(),
    calibration: score.optional(),
    consistency: score.optional(),
    fatigue: z.number().min(-100).max(100).optional(),
    wpm: z.number().min(0).max(1000).optional(),
    corrections: z.number().int().min(0).max(100000).optional(),
    categories: z.record(z.string(), score).optional(),
    classification: z.string().max(200).optional(),
    recommendation: z.string().max(3000).optional(),
    strengths: z.array(z.string().max(200)).max(10).optional(),
    weaknesses: z.array(z.string().max(200)).max(10).optional(),
    labels: z.record(z.string(), z.string().max(200)).optional(),
    timeline: z
      .array(
        z.object({
          trial: z.number().min(1),
          accuracy: score,
          latency: z.number().min(0).max(600000),
          confidence: score,
        }),
      )
      .max(1000)
      .optional(),
    distribution: z.array(z.number().min(0).max(600000)).max(5000).optional(),
  })
  .strict();
const overrideSchema = z
  .object({ mode: z.enum(['real', 'manual', 'preset', 'scripted']), values })
  .strict();
const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    override: overrideSchema,
    release: z.enum(['auto', 'hold']),
    reveal: z.enum(['immediate', 'delay', 'manual', 'disabled']),
    revealDelaySeconds: z.number().int().min(0).max(86400),
  })
  .strict();
const answerSchema = z
  .object({
    index: z.number().int().min(0),
    value: z.union([
      z.string().max(2000),
      z.number().finite(),
      z.array(z.number().finite()).max(100),
      z.object({ errors: z.array(z.number().min(0).max(1000)).max(50) }).strict(),
      z
        .object({
          answer: z.number().finite(),
          alerts: z.number().int().min(0).max(3),
          inRange: z.number().min(0).max(1),
        })
        .strict(),
      z.null(),
    ]),
    elapsedMs: z.number().min(0).max(600000),
    confidence: score,
    skipped: z.boolean().optional(),
    falseStart: z.boolean().optional(),
    corrections: z.number().int().min(0).max(10000).optional(),
  })
  .strict();
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createApp(db: Database, config: Config) {
  if (config.secret.length < 32)
    throw new Error('SESSION_SECRET must be at least 32 characters. Run npm run admin:setup.');
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: config.production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              connectSrc: ["'self'"],
              imgSrc: ["'self'", 'data:'],
              fontSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: (config.secureCookies ?? config.production) ? [] : null,
            },
          }
        : false,
      strictTransportSecurity: (config.secureCookies ?? config.production) ? undefined : false,
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  const hash = (v: string) => digest(v, config.secret);
  const adminIdentity = `${config.username}:${hash(config.passwordHash).slice(0, 32)}`;
  const audit = async (action: string, subject: string, tx = db) =>
    tx.query('INSERT INTO audit(id,action,subject,created_at) VALUES(?,?,?,?)', [
      token(),
      action,
      subject,
      now(),
    ]);
  const save = async (s: Session, tx = db) =>
    tx.query('UPDATE sessions SET status=?,data=? WHERE id=?', [s.status, JSON.stringify(s), s.id]);
  const load = async (id: string, tx = db): Promise<Session> => {
    const rs = await tx.query(
      'SELECT data FROM sessions WHERE id=?' +
        (tx !== db && tx.dialect === 'postgres' ? ' FOR UPDATE' : ''),
      [id],
    );
    if (!rs.length) throw new HttpError(404, 'Session not found');
    return JSON.parse(rs[0].data);
  };
  const rows = async (id: string, tx = db): Promise<ResponseRecord[]> =>
    (await tx.query('SELECT data FROM responses WHERE session_id=? ORDER BY trial', [id])).map(
      (r) => JSON.parse(r.data),
    );
  const auth = async (req: express.Request, role: string) => {
    const value = req.cookies[role === 'admin' ? 'cortex_admin' : 'cortex_participant'];
    if (!validToken(value))
      throw new HttpError(
        401,
        role === 'admin' ? 'Sign in to the operator console.' : 'No active session.',
      );
    const rs = await db.query(
      'SELECT * FROM auth_sessions WHERE token_hash=? AND role=? AND expires_at>?',
      [hash(value), role, now()],
    );
    if (!rs.length) throw new HttpError(401, 'Your session expired. Sign in again.');
    if (role === 'admin' && rs[0].subject !== adminIdentity)
      throw new HttpError(401, 'Operator credentials changed. Sign in again.');
    if (
      role === 'admin' &&
      !['GET', 'HEAD'].includes(req.method) &&
      req.get('x-csrf-token') !== rs[0].csrf
    )
      throw new HttpError(403, 'CSRF validation failed. Reload the console.');
    return role === 'admin' ? { ...rs[0], subject: config.username } : rs[0];
  };
  const setAuth = async (res: express.Response, role: string, subject: string) => {
    const value = token(),
      csrf = token();
    const maxAge = role === 'admin' ? 8 * 3600000 : 30 * 86400000;
    await db.query(
      'INSERT INTO auth_sessions(token_hash,role,subject,csrf,expires_at) VALUES(?,?,?,?,?)',
      [
        hash(value),
        role,
        role === 'admin' ? adminIdentity : subject,
        csrf,
        new Date(Date.now() + maxAge).toISOString(),
      ],
    );
    res.cookie(role === 'admin' ? 'cortex_admin' : 'cortex_participant', value, {
      httpOnly: true,
      secure: config.secureCookies ?? config.production,
      sameSite: 'strict',
      maxAge,
      path: '/',
    });
    return csrf;
  };
  const publicSession = (s: Session): Participant => ({
    id: s.id,
    alias: s.alias,
    mode: s.mode,
    locale: s.locale || 'en',
    seed: s.seed,
    startedAt: s.startedAt,
    status: s.status,
    cursor: s.cursor,
    total: s.total,
    difficulty: s.difficulty,
    plan: s.plan,
    released: s.released,
    revealed: s.revealed,
    elapsedMs: s.elapsedMs,
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('x-cortex-request') !== '1')
        return res.status(403).json({ error: 'Request header required' });
      const origin = req.get('origin');
      if (origin && origin !== config.origin)
        return res.status(403).json({ error: 'Origin not allowed' });
    }
    next();
  });
  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT version FROM migrations');
    res.json({ status: 'ok', version: '1.0.0' });
  });
  app.get('/api/catalog', (_req, res) => res.json({ modules }));
  app.get('/api/context', async (req, res) => {
    let participant: Participant | undefined,
      operator: { username: string; csrf: string } | undefined;
    try {
      const a = await auth(req, 'participant');
      participant = publicSession(await load(a.subject));
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 401)) throw e;
    }
    try {
      const a = await auth(req, 'admin');
      operator = { username: config.username, csrf: a.csrf };
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 401)) throw e;
    }
    res.json({ participant, operator });
  });
  app.post('/api/sessions', async (req, res) => {
    const body = z
      .object({
        alias: z.string().trim().min(1).max(40),
        mode: z.enum(['quick', 'standard', 'comprehensive', 'extended', 'custom']),
        locale: z.enum(['en', 'uk']).default('en'),
        invite: z.string().optional(),
        custom: z
          .object({
            moduleIds: z
              .array(z.enum(modules.map((m) => m.id) as [string, ...string[]]))
              .min(1)
              .max(30),
            rounds: z.number().int().min(1).max(100),
          })
          .optional(),
      })
      .strict()
      .parse(req.body);
    if (body.mode === 'custom' && !body.custom)
      throw new HttpError(400, 'Choose custom modules and rounds.');
    // One active session per browser; accidental duplicate clicks cannot abandon progress.
    try {
      const a = await auth(req, 'participant');
      const existing = await load(a.subject);
      if (existing.status !== 'complete')
        throw new HttpError(409, 'Resume or complete your current session first.');
    } catch (e) {
      if (e instanceof HttpError && e.status === 409) throw e;
    }
    const s = await db.transaction(async (tx) => {
      let p: Profile | undefined;
      if (body.invite) {
        if (!validToken(body.invite)) throw new HttpError(400, 'Invite is invalid or expired.');
        const rs = await tx.query(
          'SELECT * FROM invites WHERE token_hash=? AND expires_at>? AND uses<max_uses',
          [hash(body.invite), now()],
        );
        if (!rs.length) throw new HttpError(400, 'Invite is invalid, used, or expired.');
        const ps = await tx.query('SELECT data FROM profiles WHERE id=?', [rs[0].profile_id]);
        p = JSON.parse(ps[0].data);
        const claimed = await tx.query(
          'UPDATE invites SET uses=uses+1 WHERE token_hash=? AND uses<max_uses RETURNING token_hash',
          [hash(body.invite)],
        );
        if (!claimed.length)
          throw new HttpError(409, 'This invite was just used. Request a new link.');
      }
      const plan = makePlan(body.mode as Mode, body.custom);
      const session: Session = {
        version: schemaVersion,
        id: token(),
        alias: body.alias,
        mode: body.mode,
        locale: body.locale,
        seed: token(),
        startedAt: now(),
        status: 'active',
        cursor: 0,
        total: plan.reduce((n, p) => n + p.rounds, 0),
        difficulty: 2,
        plan,
        released: false,
        revealed: false,
        elapsedMs: 0,
        override: p?.override || { mode: 'real', values: {} },
        releaseMode: p?.release || 'auto',
        revealMode: p?.reveal || 'immediate',
        revealDelaySeconds: p?.revealDelaySeconds || 0,
        trajectory: [],
        focusLosses: 0,
      };
      await tx.query('INSERT INTO sessions(id,alias,status,started_at,data) VALUES(?,?,?,?,?)', [
        session.id,
        session.alias,
        session.status,
        session.startedAt,
        JSON.stringify(session),
      ]);
      return session;
    });
    await setAuth(res, 'participant', s.id);
    res.status(201).json(publicSession(s));
  });
  app.get('/api/session', async (req, res) => {
    const a = await auth(req, 'participant');
    res.json(publicSession(await load(a.subject)));
  });
  app.get('/api/session/challenge', async (req, res) => {
    const a = await auth(req, 'participant');
    const c = await db.transaction(async (tx) => {
      const s = await load(a.subject, tx);
      if (s.status !== 'active')
        throw new HttpError(409, 'Resume the session before starting a trial.');
      if (s.cursor >= s.total) throw new HttpError(409, 'Assessment complete.');
      s.issuedAt = Date.now();
      await save(s, tx);
      return generate(s.seed, s.plan, s.cursor, s.difficulty, s.locale).challenge;
    });
    res.json(c);
  });
  app.post('/api/session/answer', async (req, res) => {
    const a = await auth(req, 'participant');
    const answer = answerSchema.parse(req.body);
    const s = await db.transaction(async (tx) => {
      const s = await load(a.subject, tx);
      if (answer.index < s.cursor) return s;
      if (s.status !== 'active' || answer.index !== s.cursor || !s.issuedAt)
        throw new HttpError(409, 'Trial changed. Reload your current challenge.');
      const { challenge, answer: expected } = generate(
        s.seed,
        s.plan,
        s.cursor,
        s.difficulty,
        s.locale,
      );
      const score = grade(challenge, expected, answer);
      const record: ResponseRecord = {
        ...answer,
        moduleId: challenge.moduleId,
        difficulty: s.difficulty,
        score,
        correct: score >= 0.85,
        spanLength: ['span', 'sequence'].includes(challenge.family)
          ? challenge.data.sequence.length
          : undefined,
        createdAt: now(),
        condition:
          challenge.family === 'switch'
            ? `${challenge.data.rule}:${challenge.data.flip}`
            : challenge.family === 'decision'
              ? (challenge.data.payout * challenge.data.prob) / 100 > 40
                ? 'higher-expected'
                : 'lower-expected'
              : undefined,
      };
      await tx.query('INSERT INTO responses(session_id,trial,data) VALUES(?,?,?)', [
        s.id,
        s.cursor,
        JSON.stringify(record),
      ]);
      s.elapsedMs += Math.min(600000, Math.max(answer.elapsedMs, Date.now() - s.issuedAt));
      s.trajectory.push({ trial: s.cursor, difficulty: s.difficulty });
      s.cursor++;
      s.issuedAt = undefined;
      const recent: ResponseRecord[] = (
        await tx.query(
          'SELECT data FROM responses WHERE session_id=? ORDER BY trial DESC LIMIT 3',
          [s.id],
        )
      )
        .map((r) => JSON.parse(r.data))
        .reverse();
      const loc = locate(s.plan, s.cursor);
      s.difficulty =
        loc?.round === 0
          ? 2
          : loc?.module.adaptive
            ? nextDifficulty(
                s.difficulty,
                recent.filter((r) => r.moduleId === challenge.moduleId).map((r) => r.score),
              )
            : s.difficulty;
      if (s.cursor >= s.total) {
        s.status = 'complete';
        s.metrics = calculate(await rows(s.id, tx), s.total);
        if (s.releaseMode === 'auto') release(s);
      }
      await save(s, tx);
      return s;
    });
    res.json(publicSession(s));
  });
  function release(s: Session) {
    s.released = true;
    s.releasedAt = now();
    s.displayed = resolve(s.metrics!, s.override);
    scheduleReveal(s);
  }
  function scheduleReveal(s: Session) {
    const delay =
      s.revealMode === 'immediate' ? 0 : s.revealMode === 'delay' ? s.revealDelaySeconds : 86400;
    s.revealAt = new Date(
      Math.min(Date.now() + delay * 1000, Date.parse(s.releasedAt!) + 86400000),
    ).toISOString();
    s.revealed = delay === 0;
  }
  app.post('/api/session/state', async (req, res) => {
    const a = await auth(req, 'participant');
    const b = z
      .object({ paused: z.boolean().optional(), focusLost: z.boolean().optional() })
      .strict()
      .parse(req.body);
    const s = await db.transaction(async (tx) => {
      const s = await load(a.subject, tx);
      if (s.status !== 'complete' && b.paused !== undefined) {
        s.status = b.paused ? 'paused' : 'active';
        s.issuedAt = undefined;
      }
      if (b.focusLost) s.focusLosses++;
      await save(s, tx);
      return s;
    });
    res.json(publicSession(s));
  });
  app.get('/api/session/results', async (req, res) => {
    const a = await auth(req, 'participant');
    const s = await load(a.subject);
    if (!s.released) return res.json({ held: true, locale: s.locale || 'en' });
    const revealed = s.revealed || !!(s.revealAt && Date.parse(s.revealAt) <= Date.now());
    res.json({
      held: false,
      locale: s.locale || 'en',
      displayed: s.displayed,
      revealed,
      revealAt: s.revealAt,
      real: revealed ? s.metrics : undefined,
      alias: s.alias,
      seed: s.seed,
    });
  });
  app.post('/api/admin/login', async (req, res) => {
    const b = z
      .object({ username: z.string().max(100), password: z.string().max(256) })
      .strict()
      .parse(req.body);
    const key = hash(`${req.ip || 'local'}:${config.passwordHash}`);
    const rs = await db.query('SELECT * FROM login_limits WHERE key=?', [key]);
    if (rs.length && rs[0].attempts >= 5 && Date.parse(rs[0].reset_at) > Date.now())
      throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
    await db.query(
      'INSERT INTO login_limits(key,attempts,reset_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.reset_at<? THEN 1 ELSE login_limits.attempts+1 END,reset_at=CASE WHEN login_limits.reset_at<? THEN ? ELSE login_limits.reset_at END',
      [
        key,
        1,
        new Date(Date.now() + 900000).toISOString(),
        now(),
        now(),
        new Date(Date.now() + 900000).toISOString(),
      ],
    );
    if (!config.passwordHash || !config.username)
      throw new HttpError(503, 'Admin credentials are not configured. Run npm run admin:setup.');
    const valid = await verifyPassword(b.password, config.passwordHash);
    if (b.username !== config.username || !valid)
      throw new HttpError(401, 'Invalid operator credentials.');
    await db.query('DELETE FROM login_limits WHERE key=?', [key]);
    await audit('admin.login', config.username);
    const csrf = await setAuth(res, 'admin', config.username);
    res.json({ username: config.username, csrf });
  });
  app.use('/api/admin', async (req, res, next) => {
    try {
      res.locals.auth = await auth(req, 'admin');
      next();
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/admin/me', (_req, res) =>
    res.json({ username: res.locals.auth.subject, csrf: res.locals.auth.csrf }),
  );
  app.post('/api/admin/logout', async (req, res) => {
    await db.query('DELETE FROM auth_sessions WHERE token_hash=?', [
      hash(req.cookies.cortex_admin),
    ]);
    res.clearCookie('cortex_admin', { path: '/' }).json({ ok: true });
  });
  app.get('/api/admin/sessions', async (req, res) => {
    const query = z
      .string()
      .max(80)
      .parse(req.query.q || '');
    const status = z.enum(['all', 'active', 'paused', 'complete']).parse(req.query.status || 'all');
    const rs = await db.query(
      'SELECT data FROM sessions WHERE alias LIKE ?' +
        (status !== 'all' ? ' AND status=?' : '') +
        ' ORDER BY started_at DESC LIMIT 200',
      status !== 'all' ? [`%${query}%`, status] : [`%${query}%`],
    );
    res.json(rs.map((r) => JSON.parse(r.data)));
  });
  app.get('/api/admin/sessions/:id', async (req, res) => {
    const s = await load(String(req.params.id));
    const rs = await rows(s.id);
    res.json({ ...s, metrics: s.metrics || calculate(rs, s.total), responses: rs.slice(-30) });
  });
  app.patch('/api/admin/sessions/:id', async (req, res) => {
    const b = z
      .object({
        override: overrideSchema.optional(),
        releaseMode: z.enum(['auto', 'hold']).optional(),
        revealMode: z.enum(['immediate', 'delay', 'manual', 'disabled']).optional(),
        revealDelaySeconds: z.number().int().min(0).max(86400).optional(),
      })
      .strict()
      .parse(req.body);
    const s = await db.transaction(async (tx) => {
      const s = await load(String(req.params.id), tx);
      const previouslyDisclosed =
        s.revealed || !!(s.revealAt && Date.parse(s.revealAt) <= Date.now());
      Object.assign(s, b);
      if (s.released) {
        s.displayed = resolve(s.metrics!, s.override);
        if (
          !previouslyDisclosed &&
          (b.revealMode !== undefined || b.revealDelaySeconds !== undefined)
        )
          scheduleReveal(s);
      }
      await save(s, tx);
      await audit('session.override.changed', s.id, tx);
      return s;
    });
    res.json(s);
  });
  app.post('/api/admin/sessions/:id/release', async (req, res) => {
    const s = await db.transaction(async (tx) => {
      const s = await load(String(req.params.id), tx);
      if (s.status !== 'complete')
        throw new HttpError(409, 'Complete the assessment before releasing results.');
      if (!s.released) release(s);
      await save(s, tx);
      await audit('results.released', s.id, tx);
      return s;
    });
    res.json(s);
  });
  app.post('/api/admin/sessions/:id/reveal', async (req, res) => {
    const s = await db.transaction(async (tx) => {
      const s = await load(String(req.params.id), tx);
      if (!s.released) throw new HttpError(409, 'Release results before revealing.');
      s.revealed = true;
      s.revealAt = now();
      await save(s, tx);
      await audit('reveal.triggered', s.id, tx);
      return s;
    });
    res.json(s);
  });
  app.get('/api/admin/profiles', async (_req, res) =>
    res.json(
      (await db.query('SELECT data FROM profiles ORDER BY name')).map((r) => JSON.parse(r.data)),
    ),
  );
  app.post('/api/admin/profiles', async (req, res) => {
    const b = profileSchema.parse(req.body);
    const p = { ...b, id: token() };
    await db.transaction(async (tx) => {
      await tx.query('INSERT INTO profiles(id,name,data) VALUES(?,?,?)', [
        p.id,
        p.name,
        JSON.stringify(p),
      ]);
      await audit('profile.created', p.id, tx);
    });
    res.status(201).json(p);
  });
  app.patch('/api/admin/profiles/:id', async (req, res) => {
    const b = profileSchema.parse(req.body);
    const id = String(req.params.id);
    const exists = await db.query('SELECT id FROM profiles WHERE id=?', [id]);
    if (!exists.length) throw new HttpError(404, 'Profile not found');
    const p = { ...b, id };
    await db.transaction(async (tx) => {
      await tx.query('UPDATE profiles SET name=?,data=? WHERE id=?', [
        p.name,
        JSON.stringify(p),
        id,
      ]);
      await audit('profile.edited', id, tx);
    });
    res.json(p);
  });
  app.get('/api/admin/presets', (_req, res) => res.json(presets));
  app.get('/api/admin/invites', async (_req, res) =>
    res.json(
      await db.query(
        'SELECT invites.profile_id,profiles.name,invites.created_at,invites.expires_at,invites.uses,invites.max_uses FROM invites JOIN profiles ON profiles.id=invites.profile_id ORDER BY created_at DESC LIMIT 100',
      ),
    ),
  );
  app.post('/api/admin/invites', async (req, res) => {
    const b = z
      .object({
        profileId: z.string(),
        maxUses: z.number().int().min(1).max(100).default(1),
        expiresDays: z.number().int().min(1).max(90).default(7),
      })
      .strict()
      .parse(req.body);
    const ps = await db.query('SELECT id FROM profiles WHERE id=?', [b.profileId]);
    if (!ps.length) throw new HttpError(404, 'Profile not found');
    const secret = token();
    await db.query(
      'INSERT INTO invites(token_hash,profile_id,created_at,expires_at,max_uses) VALUES(?,?,?,?,?)',
      [
        hash(secret),
        b.profileId,
        now(),
        new Date(Date.now() + b.expiresDays * 86400000).toISOString(),
        b.maxUses,
      ],
    );
    await audit('invite.created', b.profileId);
    res.status(201).json({ url: `${config.origin}/assessment/start/${secret}` });
  });
  app.get('/api/admin/audit', async (_req, res) =>
    res.json(
      await db.query(
        'SELECT action,subject,created_at FROM audit ORDER BY created_at DESC LIMIT 100',
      ),
    ),
  );
  app.get('/api/admin/status', async (_req, res) =>
    res.json({
      version: '1.0.0',
      modules: modules.length,
      engineVersion: schemaVersion,
      database: 'connected',
      secureCookies: config.secureCookies ?? config.production,
      origin: config.origin,
      uptime: Math.round(process.uptime()),
    }),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: 'Invalid input',
        issues: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error('API error:', err.message);
    res.status(500).json({ error: 'The request could not be saved. Please retry.' });
  });
  return app;
}
