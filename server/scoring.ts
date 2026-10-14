import type { Answer, Challenge, Metrics, Override, ResponseRecord } from '../shared/model.js';
import { modules } from '../shared/modules.js';
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const median = (a: number[]) => {
  const sorted = [...a].sort((a, b) => a - b);
  return sorted.length
    ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2
    : 0;
};
export function grade(c: Challenge, expected: any, a: Answer): number {
  if (a.skipped || a.falseStart) return 0;
  if (c.family === 'decision') return [0, 1].includes(a.value) ? 1 : 0;
  if (c.family === 'grid') {
    const got = new Set<number>(Array.isArray(a.value) ? a.value : []);
    const wanted = new Set<number>(expected);
    const hit = [...got].filter((v) => wanted.has(v)).length;
    return clamp((hit - Math.max(0, got.size - hit)) / Math.max(1, wanted.size));
  }
  if (c.family === 'sequence') {
    if (!Array.isArray(a.value)) return 0;
    return clamp(
      expected.filter((v: number, i: number) => a.value[i] === v).length /
        Math.max(expected.length, a.value.length),
    );
  }
  if (c.family === 'search' && c.data.stream) {
    const hits = new Set<number>(Array.isArray(a.value) ? a.value : []);
    const targets = new Set<number>(expected);
    return clamp(
      ([...hits].filter((v) => targets.has(v)).length -
        [...hits].filter((v) => !targets.has(v)).length) /
        Math.max(1, targets.size),
    );
  }
  if (c.family === 'interval' || c.family === 'estimate') {
    const val = Number(a.value);
    return Number.isFinite(val) ? clamp(1 - Math.abs(val - expected) / Math.max(1, expected)) : 0;
  }
  if (c.family === 'motor') {
    if (!a.value || typeof a.value !== 'object') return 0;
    const errors = Array.isArray(a.value.errors) ? a.value.errors : [];
    return errors.length
      ? clamp(
          1 -
            errors.reduce(
              (s: number, v: number) => s + Math.min(100, Math.max(0, Number(v) || 0)),
              0,
            ) /
              errors.length /
              30,
        )
      : 0;
  }
  if (c.family === 'multi') {
    const v = a.value;
    return v && typeof v === 'object'
      ? clamp(
          (Number(v.answer) === expected ? 0.4 : 0) +
            (Math.min(3, Math.max(0, Number(v.alerts) || 0)) / 3) * 0.3 +
            clamp(Number(v.inRange) || 0) * 0.3,
        )
      : 0;
  }
  if (c.family === 'typing') {
    const canonical = (value: string) =>
      c.locale === 'uk' ? value.normalize('NFC').replace(/[’ʼ]/g, "'") : value;
    const text = canonical(String(a.value));
    expected = canonical(expected);
    let hits = 0;
    for (let i = 0; i < expected.length; i++) if (text[i] === expected[i]) hits++;
    return clamp(hits / Math.max(expected.length, text.length));
  }
  if (c.family === 'recognition' && c.data.recall)
    return String(a.value)
      .normalize('NFC')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase(c.locale === 'uk' ? 'uk-UA' : 'en-US') ===
      String(expected)
        .normalize('NFC')
        .toLocaleLowerCase(c.locale === 'uk' ? 'uk-UA' : 'en-US')
      ? 1
      : 0;
  return String(a.value) === String(expected) ? 1 : 0;
}
export function calculate(rows: ResponseRecord[], total: number): Metrics {
  const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const accuracy = mean(rows.map((r) => r.score));
  const reaction = rows
    .filter((r) => r.moduleId === 'reaction' && r.correct && !r.falseStart)
    .map((r) => r.elapsedMs);
  const med = median(reaction);
  const variance = mean(reaction.map((v) => (v - mean(reaction)) ** 2));
  const categories = Object.fromEntries(
    modules.map((m) => {
      const rs = rows.filter((r) => r.moduleId === m.id);
      return [m.id, Math.round(mean(rs.map((r) => r.score)) * 100)];
    }),
  );
  const window = Math.max(1, Math.floor(rows.length / 3));
  const first = mean(rows.slice(0, window).map((r) => r.score)),
    last = mean(rows.slice(-window).map((r) => r.score));
  const calibration = rows.length
    ? 100 * (1 - mean(rows.map((r) => (r.confidence / 100 - r.score) ** 2)))
    : 0;
  const switches = rows.filter((r) => ['switching', 'adaptability'].includes(r.moduleId));
  const switched: number[] = [],
    repeated: number[] = [];
  switches.forEach((r, i) => {
    if (i && r.condition && switches[i - 1].moduleId === r.moduleId)
      (r.condition !== switches[i - 1].condition ? switched : repeated).push(r.elapsedMs);
  });
  const decisions = rows.filter((r) => r.moduleId === 'decision');
  const decisionGroups = [...new Set(decisions.map((r) => r.condition))].map((condition) =>
    decisions.filter((r) => r.condition === condition),
  );
  if (decisions.length)
    categories.decision = Math.round(
      mean(
        decisionGroups.map(
          (group) =>
            Math.max(
              group.filter((r) => r.value === 0).length,
              group.filter((r) => r.value === 1).length,
            ) / group.length,
        ),
      ) * 100,
    );
  const consistency = rows.length
    ? 100 * clamp(1 - Math.sqrt(mean(rows.map((r) => (r.score - accuracy) ** 2))))
    : 0;
  const typed = rows.filter((r) => r.moduleId === 'typing');
  const wpm = mean(
    typed.map(
      (r) => (String(r.value).length / 5 / (Math.max(1000, r.elapsedMs) / 60000)) * r.score,
    ),
  );
  const measured = Object.entries(categories).filter(([k]) => rows.some((r) => r.moduleId === k));
  const ordered = measured.sort((a, b) => b[1] - a[1]);
  const timeline = Array.from({ length: Math.ceil(rows.length / 10) }, (_, i) => {
    const rs = rows.slice(i * 10, (i + 1) * 10);
    return {
      trial: i * 10 + 1,
      accuracy: Math.round(mean(rs.map((r) => r.score)) * 100),
      latency: Math.round(mean(rs.map((r) => r.elapsedMs))),
      confidence: Math.round(mean(rs.map((r) => r.confidence))),
    };
  });
  const index = Math.round(
    clamp(accuracy * 0.7 + (calibration / 100) * 0.15 + (consistency / 100) * 0.15) * 1000,
  );
  return {
    index,
    percentile: Math.round((index / 10) * 10) / 10,
    accuracy: Math.round(accuracy * 100),
    medianReactionMs: Math.round(med),
    reactionVariance: Math.round(variance),
    falseStartRate: Math.round(
      (rows.filter((r) => r.falseStart).length /
        Math.max(1, rows.filter((r) => ['reaction', 'impulse'].includes(r.moduleId)).length)) *
        100,
    ),
    memorySpan: Math.max(
      0,
      ...rows
        .filter((r) => r.correct && ['working-memory', 'sequence-memory'].includes(r.moduleId))
        .map(
          (r) => r.spanLength ?? (Array.isArray(r.value) ? r.value.length : String(r.value).length),
        ),
    ),
    switchCostMs: Math.round(Math.max(0, mean(switched) - mean(repeated))),
    precision: categories.precision,
    completion: Math.round((rows.length / Math.max(1, total)) * 100),
    calibration: Math.round(calibration),
    consistency: Math.round(consistency),
    fatigue: Math.round((first - last) * 100),
    wpm: Math.round(wpm),
    corrections: typed.reduce((s, r) => s + (r.corrections || 0), 0),
    categories,
    timeline,
    distribution: reaction,
    strengths: ordered.slice(0, 3).map(([k]) => modules.find((m) => m.id === k)!.name),
    weaknesses: ordered
      .slice(-3)
      .reverse()
      .map(([k]) => modules.find((m) => m.id === k)!.name),
    classification:
      index >= 800
        ? 'High response efficiency'
        : index >= 500
          ? 'Balanced operational profile'
          : 'Variable response efficiency',
    recommendation:
      'Review your dimension profile and repeat the battery under comparable conditions.',
    labels: {},
  };
}
export function resolve(real: Metrics, override: Override): Metrics {
  if (override.mode === 'real') return structuredClone(real);
  return {
    ...structuredClone(real),
    ...override.values,
    categories: { ...real.categories, ...override.values.categories },
    labels: { ...real.labels, ...override.values.labels },
  };
}
export const presets: Record<string, Override> = {
  'Absolute Disaster': {
    mode: 'preset',
    values: {
      index: 70,
      percentile: 0.4,
      classification: 'Operator troubleshooting recommended',
      recommendation:
        'Hardware appears functional. User error suspected. Turning the participant off and on again may help.',
      categories: Object.fromEntries(modules.map((m, i) => [m.id, 3 + (i % 7)])),
      labels: {
        reaction: 'Response detected eventually',
        memory: 'Data retention questionable',
        processing: 'Background process detected',
      },
      strengths: ['Successfully remained seated', 'Completed a substantial number of clicks'],
      weaknesses: ['Bottleneck between keyboard and chair', 'Unscheduled background thinking'],
    },
  },
  'Suspiciously Average': {
    mode: 'preset',
    values: {
      index: 500,
      percentile: 50,
      categories: Object.fromEntries(modules.map((m) => [m.id, 50])),
      classification: 'Remarkably unremarkable',
      recommendation: 'Performance falls directly in the center of our fictional benchmark.',
    },
  },
  'Impossible Genius': {
    mode: 'preset',
    values: {
      index: 1000,
      percentile: 99.9,
      categories: Object.fromEntries(modules.map((m) => [m.id, 100])),
      classification: 'Reference hardware exceeded',
      recommendation: 'Further testing recommended after updating the universe.',
    },
  },
  Chaotic: {
    mode: 'preset',
    values: {
      index: 420,
      percentile: 42,
      categories: Object.fromEntries(modules.map((m, i) => [m.id, i % 2 ? 97 : 4])),
      classification: 'Asymmetric operational anomaly',
      recommendation: 'A software update may improve compatibility with ordinary tasks.',
    },
  },
};
