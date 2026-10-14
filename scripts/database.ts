import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { openDatabase } from '../server/database.js';
import { token, digest } from '../server/auth.js';
import { calculate, presets } from '../server/scoring.js';
import { generate } from '../server/generators.js';
import { makePlan } from '../shared/modules.js';
import type { ResponseRecord } from '../shared/model.js';
const command = process.argv[2];
const db = await openDatabase(process.env.DATABASE_URL || 'sqlite:./data/cortex.db');
try {
  if (command === 'reset') {
    console.log(
      'This removes every assessment, response, profile, invite, auth session and audit record. Back up first.',
    );
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const confirmed = await rl.question('Type RESET CORTEX to confirm: ');
    rl.close();
    if (confirmed !== 'RESET CORTEX') throw new Error('Reset canceled.');
    await db.transaction(async (tx) => {
      for (const table of [
        'responses',
        'invites',
        'profiles',
        'sessions',
        'auth_sessions',
        'audit',
        'login_limits',
      ])
        await tx.query(`DELETE FROM ${table}`);
    });
    console.log('Database reset.');
  } else if (command === 'migrate') console.log('Database migrations applied.');
  else if (command === 'demo') {
    if (!process.env.SESSION_SECRET) throw new Error('Run npm run admin:setup first.');
    const id = token();
    const p = {
      id,
      name: 'Demo · Absolute Disaster',
      override: presets['Absolute Disaster'],
      release: 'hold',
      reveal: 'manual',
      revealDelaySeconds: 30,
    };
    await db.query('INSERT INTO profiles(id,name,data) VALUES(?,?,?)', [
      id,
      p.name,
      JSON.stringify(p),
    ]);
    const invite = token();
    await db.query(
      'INSERT INTO invites(token_hash,profile_id,created_at,expires_at,max_uses) VALUES(?,?,?,?,?)',
      [
        digest(invite, process.env.SESSION_SECRET),
        id,
        new Date().toISOString(),
        new Date(Date.now() + 7 * 86400000).toISOString(),
        10,
      ],
    );
    const plan = makePlan('custom', {
      moduleIds: ['reaction', 'visual-memory', 'logic', 'precision', 'typing'],
      rounds: 3,
    });
    const seed = token(),
      sid = token();
    const rs: ResponseRecord[] = Array.from({ length: 15 }, (_, index) => {
      const { challenge, answer } = generate(seed, plan, index, 2);
      return {
        index,
        moduleId: challenge.moduleId,
        difficulty: 2,
        value: answer,
        elapsedMs: challenge.family === 'reaction' ? 230 + index * 20 : 12000 + index * 650,
        confidence: 80,
        score: index % 5 === 0 ? 0.5 : 1,
        correct: index % 5 !== 0,
        createdAt: new Date().toISOString(),
      };
    });
    const metrics = calculate(rs, 15);
    const s = {
      version: 1,
      id: sid,
      alias: 'Demo subject',
      mode: 'custom',
      seed,
      startedAt: new Date().toISOString(),
      status: 'complete',
      cursor: 15,
      total: 15,
      difficulty: 2,
      plan,
      metrics,
      released: false,
      revealed: false,
      elapsedMs: rs.reduce((sum, r) => sum + r.elapsedMs, 0),
      override: p.override,
      releaseMode: 'hold',
      revealMode: 'manual',
      revealDelaySeconds: 30,
      trajectory: rs.map((r) => ({ trial: r.index, difficulty: 2 })),
      focusLosses: 0,
    };
    await db.transaction(async (tx) => {
      await tx.query('INSERT INTO sessions(id,alias,status,started_at,data) VALUES(?,?,?,?,?)', [
        sid,
        s.alias,
        s.status,
        s.startedAt,
        JSON.stringify(s),
      ]);
      for (const r of rs)
        await tx.query('INSERT INTO responses(session_id,trial,data) VALUES(?,?,?)', [
          sid,
          r.index,
          JSON.stringify(r),
        ]);
    });
    console.log(
      `Demo session & profile created. Demo invite: ${process.env.APP_ORIGIN || 'http://localhost:3000'}/assessment/start/${invite}`,
    );
  } else throw new Error('Usage: npm run db:migrate | npm run db:reset | npm run demo');
} finally {
  await db.close();
}
