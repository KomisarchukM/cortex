import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../server/generators.js';
import { grade } from '../server/scoring.js';
import { modules } from '../shared/modules.js';
import { modes } from '../shared/model.js';
import { translate } from '../shared/localization.js';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
test('all modules, instructions and modes have Ukrainian translations', () => {
  for (const module of modules)
    for (const value of [module.name, module.instructions])
      assert.notEqual(translate(value, 'uk'), value, value);
  for (const mode of Object.values(modes))
    for (const value of [mode.name, mode.description])
      assert.notEqual(translate(value, 'uk'), value, value);
});
test('all Ukrainian generated variants preserve answer positions, language and deterministic scoring', () => {
  for (const module of modules)
    for (const difficulty of [1, 3, 8])
      for (let round = 0; round < 30; round++) {
        const plan = [{ moduleId: module.id, rounds: 30 }],
          en = generate('uk-variants', plan, round, difficulty),
          localized = generate('uk-variants', plan, round, difficulty, 'uk'),
          c = localized.challenge;
        assert.deepEqual(localized, generate('uk-variants', plan, round, difficulty, 'uk'));
        assert.ok(!/\b[A-Za-z]{2,}\b/.test(c.prompt), `${module.id}/${round}: ${c.prompt}`);
        if (c.options) {
          assert.equal(
            new Set(c.options).size,
            c.options.length,
            `Duplicate Ukrainian choices: ${module.id}/${round}`,
          );
          for (const option of c.options) assert.ok(!/\b[A-Za-z]{2,}\b/.test(option), option);
          assert.equal(localized.answer, en.answer);
        }
        if (c.data.study) for (const word of c.data.study) assert.match(word, /[А-Яа-яІіЇїЄєҐґ]/);
        if (c.family === 'typing') {
          assert.match(c.data.passage, /[ІіЇїЄєҐґ]/);
          assert.equal(localized.answer, c.data.passage);
        }
        if (!['motor', 'multi', 'decision'].includes(c.family))
          assert.equal(
            grade(c, localized.answer, {
              index: round,
              value: localized.answer,
              elapsedMs: 500,
              confidence: 100,
            }),
            1,
            `${module.id}/${round}`,
          );
      }
});
test('typing accepts Ukrainian keyboard apostrophes and NFC, recall ignores boundary whitespace', () => {
  const generated = generate('uk-text', [{ moduleId: 'typing', rounds: 1 }], 0, 2, 'uk');
  generated.challenge.data.passage = 'Об’єкт у пам’яті.';
  assert.equal(
    grade(generated.challenge, 'Об’єкт у пам’яті.', {
      index: 0,
      value: "Об'єкт у пам'яті.",
      elapsedMs: 2000,
      confidence: 100,
    }),
    1,
  );
  const recall = generate('uk-text', [{ moduleId: 'verbal-memory', rounds: 3 }], 2, 2, 'uk');
  assert.equal(
    grade(recall.challenge, recall.answer, {
      index: 2,
      value: `  ${recall.answer.toUpperCase()}  `,
      elapsedMs: 2000,
      confidence: 100,
    }),
    1,
  );
});
test('participant UI translation calls have dictionary coverage', () => {
  const files = [
    'src/pages/Workspace.tsx',
    'src/pages/Assessment.tsx',
    'src/pages/Results.tsx',
    'src/components/Chrome.tsx',
    'src/components/Charts.tsx',
    'src/components/tests/Task.tsx',
    'src/components/tests/Instruments.tsx',
  ];
  const technical = new Set(['CORTEX', 'P', 'K–17', 'v1.0']);
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (n: ts.Node) => {
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(source) === 't' &&
        n.arguments[0] &&
        ts.isStringLiteral(n.arguments[0])
      ) {
        const text = n.arguments[0].text.trim();
        if (/[A-Za-z]/.test(text) && !technical.has(text))
          assert.notEqual(translate(text, 'uk'), text, `${file}: ${text}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(source);
  }
});
