import type { Module, Mode, PlanBlock } from './model.js';
const specs: [string, string, Module['family'], string, number][] = [
  [
    'reaction',
    'Reaction time',
    'reaction',
    'Wait for the stimulus. Respond as soon as it appears. Never anticipate it.',
    7,
  ],
  [
    'visual-memory',
    'Visual memory',
    'grid',
    'Study the illuminated cells. Reconstruct the pattern after it disappears.',
    16,
  ],
  [
    'working-memory',
    'Working memory',
    'span',
    'Hold the sequence in mind. Follow the forward, reverse, or updating rule.',
    18,
  ],
  [
    'sequence-memory',
    'Sequence memory',
    'sequence',
    'Watch the ordered sequence of positions, colors, or symbols. Reproduce its order.',
    18,
  ],
  [
    'verbal-memory',
    'Verbal memory',
    'recognition',
    'Study the words. Identify the original word among distractors.',
    16,
  ],
  [
    'attention',
    'Attention',
    'search',
    'Find the target in a field of distractors. Accuracy comes first.',
    14,
  ],
  [
    'inhibition',
    'Inhibitory control',
    'stroop',
    'Identify the INK color, ignoring the written color word.',
    9,
  ],
  [
    'processing',
    'Processing speed',
    'match',
    'Use the symbol key to identify the corresponding code quickly.',
    9,
  ],
  [
    'logic',
    'Logical reasoning',
    'choice',
    'Read the constraints and select the only justified conclusion.',
    23,
  ],
  [
    'numerical',
    'Numerical reasoning',
    'choice',
    'Solve the numerical problem. No calculator is needed.',
    22,
  ],
  [
    'pattern',
    'Pattern recognition',
    'pattern',
    'Identify the missing element in the visual progression.',
    18,
  ],
  [
    'spatial',
    'Spatial reasoning',
    'spatial',
    'Compare orientations and follow spatial transformations.',
    20,
  ],
  [
    'language',
    'Verbal reasoning',
    'choice',
    'Consider the relationship or sentence carefully. Choose the best answer.',
    20,
  ],
  [
    'decision',
    'Decision making',
    'decision',
    'Balance uncertain outcomes. There may be no single correct preference.',
    22,
  ],
  [
    'switching',
    'Task switching',
    'switch',
    'A square frame means classify COLOR. A circle means classify PARITY.',
    11,
  ],
  [
    'multitasking',
    'Multitasking',
    'multi',
    'Keep the gauge in range, acknowledge alerts, and solve the calculation.',
    22,
  ],
  [
    'visual-search',
    'Visual search',
    'search',
    'Locate the single orientation or symbol mismatch.',
    14,
  ],
  [
    'estimation',
    'Estimation',
    'estimate',
    'Estimate the quantity, angle, length, or percentage shown.',
    18,
  ],
  [
    'temporal',
    'Temporal perception',
    'interval',
    'Start, then stop after the requested interval. No clock will be shown.',
    13,
  ],
  [
    'precision',
    'Motor precision',
    'motor',
    'Hit the target centers, follow the path, or stop the marker accurately.',
    18,
  ],
  [
    'typing',
    'Typing',
    'typing',
    'Copy only the displayed passage. Aim for accuracy and a steady rhythm.',
    45,
  ],
  [
    'error-detection',
    'Error detection',
    'error',
    'Find the one inconsistent entry in the strings, table, or sequence.',
    18,
  ],
  [
    'rule-discovery',
    'Rule discovery',
    'rule',
    'Infer the rule from accepted examples. Choose the item that belongs.',
    24,
  ],
  [
    'adaptability',
    'Adaptability',
    'switch',
    'The response rule changes. Use the CURRENT rule printed above the stimulus.',
    12,
  ],
  [
    'impulse',
    'Impulse control',
    'reaction',
    'Ignore HOLD signals. Respond only when the release signal appears.',
    9,
  ],
  [
    'consistency',
    'Consistency',
    'match',
    'Apply the code accurately. Equivalent structures return later in the battery.',
    12,
  ],
  [
    'fatigue',
    'Performance over time',
    'search',
    'Continue scanning carefully. Changes over time are measured across all tasks.',
    14,
  ],
  [
    'calibration',
    'Confidence calibration',
    'choice',
    'Solve the challenge and rate your confidence before submitting.',
    22,
  ],
  [
    'retention',
    'Information retention',
    'recognition',
    'Recall the protocol details you encountered during the initial briefing.',
    20,
  ],
  [
    'distractors',
    'Distractor resistance',
    'search',
    'Find the target while ignoring the changing perimeter markers.',
    14,
  ],
];
export const modules: Module[] = specs.map(([id, name, family, instructions, seconds]) => ({
  id,
  name,
  category: id,
  family,
  instructions,
  seconds,
  adaptive: !['decision', 'typing', 'temporal'].includes(id),
}));
export const byId = Object.fromEntries(modules.map((m) => [m.id, m]));
export const schemaVersion = 1;
export function makePlan(
  mode: Mode,
  custom?: { moduleIds: string[]; rounds: number },
): PlanBlock[] {
  if (mode === 'custom' && custom)
    return custom.moduleIds.map((moduleId) => ({ moduleId, rounds: custom.rounds }));
  const selected =
    mode === 'quick'
      ? modules.filter((m) =>
          [
            'reaction',
            'visual-memory',
            'working-memory',
            'inhibition',
            'logic',
            'precision',
            'typing',
          ].includes(m.id),
        )
      : modules;
  const minutes =
    mode === 'quick' ? 10 : mode === 'standard' ? 30 : mode === 'comprehensive' ? 60 : 105;
  const passes = mode === 'extended' ? 3 : mode === 'comprehensive' ? 2 : 1;
  const scale = (minutes * 60) / selected.reduce((s, m) => s + m.seconds, 0) / passes;
  return Array.from({ length: passes }, () =>
    selected.map((m) => ({ moduleId: m.id, rounds: Math.max(2, Math.round(scale)) })),
  ).flat();
}
export function locate(plan: PlanBlock[], index: number) {
  let start = 0;
  for (let block = 0; block < plan.length; block++) {
    const p = plan[block];
    if (index < start + p.rounds)
      return { module: byId[p.moduleId], block, round: index - start, rounds: p.rounds };
    start += p.rounds;
  }
  return null;
}
export function nextDifficulty(current: number, scores: number[]) {
  const last = scores.slice(-3);
  if (last.length < 3) return current;
  return Math.max(
    1,
    Math.min(
      8,
      current +
        (last.every((s) => s >= 0.85) ? 1 : last.filter((s) => s < 0.5).length >= 2 ? -1 : 0),
    ),
  );
}
