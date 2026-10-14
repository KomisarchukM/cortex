import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, rng } from '../server/generators.js';
import { calculate, grade, median, resolve, presets } from '../server/scoring.js';
import { makePlan, modules, nextDifficulty, locate } from '../shared/modules.js';
import { passwordHash, verifyPassword, token, validToken, digest } from '../server/auth.js';
import type { Answer, ResponseRecord } from '../shared/model.js';
test('seeded generators are repeatable for every family at all difficulties', () => {
  for (const m of modules)
    for (let difficulty = 1; difficulty <= 8; difficulty++) {
      const plan = [{ moduleId: m.id, rounds: 12 }];
      for (let index = 0; index < 12; index++) {
        const a = generate('repeatable', plan, index, difficulty);
        assert.deepEqual(a, generate('repeatable', plan, index, difficulty));
        assert.equal(a.challenge.moduleId, m.id);
        assert.ok(a.challenge.budgetMs > 0);
        if (a.challenge.options)
          assert.ok(a.answer === null || (a.answer >= 0 && a.answer < a.challenge.options.length));
      }
    }
  assert.notEqual(rng('a')(), rng('b')());
});
test('scoring handles correct, wrong, false-start, partial, skipped and malformed answers', () => {
  const plan = [{ moduleId: 'logic', rounds: 1 }];
  const { challenge, answer } = generate('test', plan, 0, 3);
  const a: Answer = { index: 0, value: answer, elapsedMs: 1000, confidence: 80 };
  assert.equal(grade(challenge, answer, a), 1);
  assert.equal(grade(challenge, answer, { ...a, value: 99 }), 0);
  assert.equal(grade(challenge, answer, { ...a, falseStart: true }), 0);
  assert.equal(grade(challenge, answer, { ...a, skipped: true }), 0);
  const grid = generate('test', [{ moduleId: 'visual-memory', rounds: 1 }], 0, 2);
  assert.equal(grade(grid.challenge, grid.answer, { ...a, value: grid.answer }), 1);
  assert.ok(grade(grid.challenge, grid.answer, { ...a, value: grid.answer.slice(0, 2) }) < 1);
  const interval = generate('test', [{ moduleId: 'temporal', rounds: 1 }], 0, 2);
  assert.equal(grade(interval.challenge, interval.answer, { ...a, value: interval.answer }), 1);
  assert.equal(grade(interval.challenge, interval.answer, { ...a, value: 'invalid' }), 0);
});
test('metrics use actual response data and stay finite for empty or small batteries', () => {
  assert.equal(median([100, 400, 200, 300]), 250);
  const empty = calculate([], 1);
  assert.equal(empty.completion, 0);
  assert.equal(empty.accuracy, 0);
  assert.equal(empty.index, 0);
  const rs: ResponseRecord[] = [100, 200, 300].map((ms, index) => ({
    index,
    value: 'GO',
    elapsedMs: ms,
    confidence: 100,
    moduleId: 'reaction',
    difficulty: 2,
    score: 1,
    correct: true,
    createdAt: new Date().toISOString(),
  }));
  const m = calculate(rs, 3);
  assert.equal(m.accuracy, 100);
  assert.equal(m.medianReactionMs, 200);
  assert.equal(m.calibration, 100);
  assert.equal(m.completion, 100);
  assert.ok(m.reactionVariance > 0);
});
test('overrides preserve genuine results and deeply merge partial categories', () => {
  const real = calculate([], 10);
  real.index = 800;
  real.categories.reaction = 77;
  const displayed = resolve(real, {
    mode: 'manual',
    values: { index: 7, categories: { logic: 2 } },
  });
  assert.equal(displayed.index, 7);
  assert.equal(displayed.categories.reaction, 77);
  assert.equal(real.index, 800);
  assert.notEqual(real.categories, displayed.categories);
  assert.equal(resolve(real, { mode: 'real', values: { index: 1 } }).index, 800);
  assert.equal(resolve(real, presets['Absolute Disaster']).percentile, 0.4);
});
test('adaptive difficulty responds to repeated evidence and stays bounded', () => {
  assert.equal(nextDifficulty(2, [1, 1, 1]), 3);
  assert.equal(nextDifficulty(2, [0, 0, 1]), 1);
  assert.equal(nextDifficulty(8, [1, 1, 1]), 8);
  assert.equal(nextDifficulty(1, [0, 0, 0]), 1);
  assert.equal(nextDifficulty(4, [1]), 4);
});
test('all modes have sensible plans and repeated research passes', () => {
  for (const mode of ['quick', 'standard', 'comprehensive', 'extended'] as const) {
    const p = makePlan(mode);
    assert.ok(p.length >= 7);
    assert.ok(p.every((b) => b.rounds >= 2));
    assert.equal(locate(p, 0)?.round, 0);
    assert.equal(
      locate(
        p,
        p.reduce((sum, b) => sum + b.rounds, 0),
      ),
      null,
    );
  }
  assert.equal(makePlan('extended').length, 90);
  assert.equal(makePlan('custom', { moduleIds: ['logic'], rounds: 2 })[0].rounds, 2);
});
test('tokens are random, validated, keyed, and passwords are salted', async () => {
  const one = token(),
    two = token();
  assert.ok(validToken(one));
  assert.notEqual(one, two);
  assert.equal(validToken('../bad'), false);
  assert.equal(validToken('a'.repeat(42)), false);
  assert.notEqual(digest(one, 'secret'), digest(one, 'different'));
  const hash = await passwordHash('test-only-password');
  assert.equal(await verifyPassword('test-only-password', hash), true);
  assert.equal(await verifyPassword('incorrect', hash), false);
  assert.equal(await verifyPassword('anything', 'bad'), false);
});
