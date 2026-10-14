import { byId, locate } from '../shared/modules.js';
import type { Challenge, PlanBlock, Locale } from '../shared/model.js';
import { translate } from '../shared/localization.js';
export function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled<T>(items: T[], random: () => number) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const words = [
  'river',
  'window',
  'copper',
  'garden',
  'cloud',
  'paper',
  'bridge',
  'lamp',
  'forest',
  'stone',
  'anchor',
  'basket',
  'clock',
  'field',
  'lemon',
  'train',
  'planet',
  'chair',
  'ribbon',
  'ocean',
  'pencil',
  'island',
  'button',
  'candle',
];
const passages = [
  'The small observatory stood above the valley. Each evening, a single light marked its quiet position on the hill.',
  'A reliable system makes its limits visible. Clear instructions matter just as much as fast responses and careful measurements.',
  'The crew checked the instruments before departure. A clean map and a steady compass were enough to begin the journey.',
  'At the edge of the garden, rain collected on the leaves. The path led past a wooden gate and into an open field.',
  'The archive kept a record of every experiment. Some pages held useful discoveries; others explained what to try differently.',
];
const verbal = [
  [
    'Which pair belongs with “wide : narrow”?',
    ['high : low', 'high : tall', 'low : short', 'large : big'],
    0,
  ],
  [
    'The delivery arrives only if the gate opens. The delivery arrived. What follows?',
    ['The gate opened', 'Every gate opened', 'The gate stayed closed', 'No delivery was planned'],
    0,
  ],
  [
    'The guide is shorter than the manual but longer than the note. Which is shortest?',
    ['The note', 'The guide', 'The manual', 'Cannot tell'],
    0,
  ],
  ['Which is a tool rather than a material?', ['Hammer', 'Copper', 'Wood', 'Glass'], 0],
  [
    'A shelf has books and nothing else. Which item cannot be on it?',
    ['A cup', 'A red book', 'A small book', 'A guidebook'],
    0,
  ],
  [
    'Which relation matches “boat : water”?',
    ['train : track', 'train : ticket', 'water : rain', 'boat : sail'],
    0,
  ],
  [
    '“At least one light is on” means…',
    [
      'One or more lights are on',
      'Exactly one light is on',
      'Every light is on',
      'No lights are off',
    ],
    0,
  ],
  [
    'Before packing, Ana labels every box. A packed box is found. What must be true?',
    ['It was labeled', 'It is full', 'It is heavy', 'It is red'],
    0,
  ],
  ['Choose the odd category: oak, pine, maple, stone.', ['Stone', 'Oak', 'Pine', 'Maple'], 0],
  [
    'What best summarizes “The meeting moved to Friday because Tuesday was unavailable”?',
    [
      'A scheduling conflict changed the date',
      'The meeting was canceled',
      'Friday was unavailable',
      'The meeting became shorter',
    ],
    0,
  ],
  [
    'One jar is transparent. Another is opaque. Which can be seen through?',
    ['The transparent jar', 'The opaque jar', 'Both jars', 'Neither jar'],
    0,
  ],
  ['Which describes the opposite of “temporary”?', ['Permanent', 'Brief', 'Recent', 'Frequent'], 0],
  [
    'Jules walks at dawn, before the market opens. Which event happens first?',
    ['The walk', 'The market opens', 'Both together', 'Cannot tell'],
    0,
  ],
  [
    'The map shows a road connecting A directly to B. Which is supported?',
    ['A direct route exists', 'The route is short', 'The route is free', 'The road is empty'],
    0,
  ],
  [
    'Which relation matches “author : book”?',
    ['composer : song', 'song : sound', 'book : paper', 'reader : shelf'],
    0,
  ],
  [
    'No square tokens are green. A token is green. What follows?',
    ['It is not square', 'It is round', 'It is small', 'It is square'],
    0,
  ],
  [
    'The instruction says “Use either tray, but not both.” Which is allowed?',
    ['Use only the left tray', 'Use both trays', 'Use no tray', 'Use a third tray'],
    0,
  ],
  [
    'A narrow path allows only one cart at a time. What does this limit?',
    ['Simultaneous passage', 'Total daily carts', 'Cart color', 'Travel destination'],
    0,
  ],
  [
    'Which word belongs with measure, compare and record?',
    ['Observe', 'Forget', 'Hide', 'Discard'],
    0,
  ],
  [
    'The note says “The blue file replaced the old green file.” Which file is current?',
    ['Blue', 'Green', 'Both', 'Neither'],
    0,
  ],
  ['Compass is to direction as clock is to…', ['time', 'distance', 'weight', 'temperature'], 0],
  ['Which item belongs with river, lake, and ocean?', ['pond', 'mountain', 'road', 'cloud'], 0],
  [
    'All crates in room A are sealed. This crate is in room A. What follows?',
    ['It is sealed', 'It is empty', 'It is heavy', 'It is blue'],
    0,
  ],
  [
    'Mira arrived before Sol. Sol arrived before Lee. Who arrived last?',
    ['Lee', 'Mira', 'Sol', 'Cannot tell'],
    0,
  ],
  [
    'A report says: “Only the red lamps are on.” Which claim follows?',
    ['No blue lamp is on', 'Every red lamp is on', 'There are no blue lamps', 'All lamps are red'],
    0,
  ],
  ['A key is to a lock as a ticket is to…', ['entry', 'paper', 'price', 'queue'], 0],
  [
    'The box was light but large. Which is known?',
    ['It had little weight', 'It was empty', 'It was fragile', 'It was made of wood'],
    0,
  ],
  [
    'Which pair has the same relation as seed and tree?',
    ['egg and bird', 'bird and sky', 'tree and leaf', 'river and boat'],
    0,
  ],
  [
    'Every route is either open or closed. Route B is not closed. Therefore…',
    ['Route B is open', 'Route A is closed', 'All routes are open', 'Route B is shortest'],
    0,
  ],
  [
    'Which is the most precise summary: “The bus left late because a bridge was closed”?',
    [
      'A closure delayed departure',
      'The driver forgot the route',
      'The bridge broke the bus',
      'The trip was canceled',
    ],
    0,
  ],
] as const;
export function generate(
  seed: string,
  plan: PlanBlock[],
  index: number,
  difficulty: number,
  locale: Locale = 'en',
): { challenge: Challenge; answer: any } {
  const loc = locate(plan, index);
  if (!loc) throw new Error('No challenge at this index');
  const m = byId[loc.module.id];
  const r = rng(`${seed}:${index}:${difficulty}`);
  const int = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  const pick = <T>(a: readonly T[]) => a[int(0, a.length - 1)];
  const c: Challenge = {
    index,
    moduleId: m.id,
    family: m.family,
    difficulty,
    prompt: m.instructions,
    data: {},
    budgetMs: m.seconds * 2000,
  };
  let answer: any;
  const options = (correct: string, distractors: string[]) => {
    c.options = shuffled([...new Set([correct, ...distractors])], r);
    answer = c.options.indexOf(correct);
  };
  switch (m.family) {
    case 'reaction': {
      const variant =
        m.id === 'impulse' ? 'inhibition' : ['simple', 'choice', 'tone', 'visual'][loc.round % 4];
      const go = variant !== 'inhibition' || r() > 0.3;
      c.data = {
        delay: int(1400, 4200),
        variant,
        go,
        cue: variant === 'choice' ? pick(['LEFT', 'RIGHT']) : 'GO',
        windowMs: 3500,
      };
      answer = go ? c.data.cue : 'withhold';
      break;
    }
    case 'grid': {
      const size = difficulty > 4 ? 5 : 4;
      const cells = shuffled(
        Array.from({ length: size * size }, (_, i) => i),
        r,
      ).slice(0, Math.min(3 + difficulty, size * size - 2));
      c.data = { size, cells, exposureMs: Math.max(900, 2500 - difficulty * 120) };
      answer = cells;
      break;
    }
    case 'span': {
      const length = Math.min(9, 3 + difficulty);
      const sequence = Array.from({ length }, () => int(0, 9));
      const variant = ['forward', 'reverse', 'update', 'nback', 'symbols', 'spatial'][
        loc.round % 6
      ];
      c.data = { sequence, variant, stepMs: 650 };
      c.prompt =
        variant === 'reverse'
          ? 'Repeat the digits in reverse order.'
          : variant === 'update'
            ? 'Keep only the last three digits.'
            : variant === 'nback'
              ? 'Which digit appeared two positions before the last?'
              : variant === 'symbols'
                ? 'Repeat the symbol order using the key.'
                : variant === 'spatial'
                  ? 'Recall the numbered positions in order.'
                  : 'Repeat the digits in their original order.';
      answer =
        variant === 'reverse'
          ? [...sequence].reverse().join('')
          : variant === 'update'
            ? sequence.slice(-3).join('')
            : variant === 'nback'
              ? String(sequence.at(-3))
              : sequence.join('');
      break;
    }
    case 'sequence': {
      const sequence = Array.from({ length: Math.min(10, 3 + difficulty) }, () => int(0, 5));
      c.data = { sequence, variant: ['positions', 'colors', 'shapes'][loc.round % 3], stepMs: 650 };
      answer = sequence;
      break;
    }
    case 'recognition': {
      if (m.id === 'retention') {
        const qs = [
          ['What was the briefing protocol code?', 'K-17', ['K-71', 'R-17', 'K-07']],
          ['What was the reference material?', 'Copper', ['Silver', 'Carbon', 'Glass']],
          ['What was the baseline station?', 'North', ['East', 'South', 'West']],
        ] as const;
        const q = qs[loc.round % 3];
        c.prompt = q[0];
        c.data = { study: [], exposureMs: 0 };
        options(q[1], [...q[2]]);
      } else {
        const study = shuffled(words, r).slice(0, 3 + difficulty);
        const target = pick(study);
        c.data = {
          study,
          exposureMs: 3200,
          delayed: loc.round % 2 === 1,
          delayMs: loc.round % 2 === 1 ? 5000 : 0,
        };
        options(
          target,
          shuffled(
            words.filter((w) => !study.includes(w)),
            r,
          ).slice(0, 3),
        );
        c.prompt = 'Which word was in the original set?';
        if (loc.round % 3 === 2) {
          c.data.recall = true;
          c.options = undefined;
          c.prompt = 'Recall the first three words in order, separated by spaces.';
          answer = study.slice(0, 3).join(' ');
        }
      }
      break;
    }
    case 'search': {
      if ((m.id === 'attention' || m.id === 'fatigue') && loc.round % 2 === 1) {
        const stream = Array.from({ length: 18 + difficulty * 2 }, () =>
          pick(['○', '△', '□', '◇']),
        );
        // Ensure a target exists in every generated stream.
        stream[int(0, stream.length - 1)] = '◇';
        c.data = { stream, targetSymbol: '◇', stepMs: Math.max(450, 1000 - difficulty * 55) };
        c.prompt = 'Watch the changing symbols. Detect each diamond, ignoring every other shape.';
        answer = stream.map((symbol, i) => (symbol === '◇' ? i : -1)).filter((i) => i >= 0);
        break;
      }
      const count = 24 + difficulty * 6;
      const target = int(0, count - 1);
      const variant = loc.round % 3;
      const base = variant === 0 ? '↗' : variant === 1 ? 'O' : '◇';
      const unusual = variant === 0 ? '↖' : variant === 1 ? 'Q' : '◆';
      c.data = {
        symbols: Array.from({ length: count }, (_, i) => (i === target ? unusual : base)),
        targetSymbol: unusual,
        distractors: m.id === 'distractors',
        sustained: m.id === 'fatigue',
        timeLimitMs: 20000,
      };
      c.prompt = `Find ${unusual} among the ${base} symbols.`;
      answer = target;
      break;
    }
    case 'stroop': {
      const colors = ['BLUE', 'AMBER', 'RED', 'GREEN'];
      const ink = int(0, 3);
      c.data = { word: pick(colors), ink, colors };
      c.options = colors;
      answer = ink;
      break;
    }
    case 'match': {
      const symbols = ['⊕', '△', '□', '◇', '○', '✕'];
      const key = shuffled([1, 2, 3, 4, 5, 6], r);
      const target = int(0, 5);
      c.data = { symbols, key, target: symbols[target], transform: loc.round % 2 };
      c.prompt = loc.round % 2 ? 'Find the code, then add one.' : 'Find the matching code.';
      options(String(key[target] + (loc.round % 2)), [
        String(key[target] + 2),
        String(key[target] - 1),
        String(key[target] + 3),
      ]);
      break;
    }
    case 'choice': {
      if (m.id === 'numerical' || m.id === 'calibration') {
        const a = int(3, 10 + difficulty * 6),
          b = int(2, 10 + difficulty * 2);
        const variant = loc.round % 5;
        let correct: number;
        if (variant === 0) {
          c.prompt = `${a} × ${b} = ?`;
          correct = a * b;
        } else if (variant === 1) {
          const percent = pick([10, 20, 25, 50]);
          const n = int(4, 15) * 20;
          c.prompt = `What is ${percent}% of ${n}?`;
          correct = (n * percent) / 100;
        } else if (variant === 2) {
          c.prompt = `${a}, ${a + b}, ${a + 2 * b}, ${a + 3 * b}, …`;
          correct = a + 4 * b;
        } else if (variant === 3) {
          c.prompt = `A box contains ${b} blue and ${b * 3} white tiles. What percentage are blue?`;
          correct = 25;
        } else {
          c.prompt = `The ratio of small to large parts is 2:3. There are ${a * 2} small parts. How many large parts?`;
          correct = a * 3;
        }
        options(String(correct), [
          String(correct + int(1, 5)),
          String(correct - int(1, 5)),
          String(correct + int(6, 12)),
        ]);
      } else if (m.id === 'logic') {
        const v = loc.round % 4;
        const n = int(2, 8);
        if (v === 0) {
          c.prompt = `A is earlier than B. C is later than B. D is earlier than A. Which is the full order?`;
          options('D → A → B → C', ['A → D → C → B', 'D → B → A → C', 'C → A → B → D']);
        } else if (v === 1) {
          c.prompt = `Every ${pick(['copper', 'round', 'marked'])} token is in tray A. No token in tray A is damaged. Which conclusion must hold?`;
          options('None of those tokens is damaged', [
            'Every undamaged token is in A',
            'Every token is undamaged',
            'Tray A contains every token',
          ]);
        } else if (v === 2) {
          c.prompt = `A counter doubles, then adds ${n} each step. Starting at 1, the first two values are ${2 + n} and ${(2 + n) * 2 + n}. What is next?`;
          const val = ((2 + n) * 2 + n) * 2 + n;
          options(String(val), [String(val + 1), String(val - n), String(val * 2)]);
        } else {
          c.prompt = 'If a lamp is on, its switch is closed. The switch is open. What follows?';
          options('The lamp is off', ['The lamp is on', 'The lamp is broken', 'No conclusion']);
        }
      } else {
        const q = verbal[loc.round % verbal.length];
        c.prompt = q[0];
        options(
          q[1][q[2]],
          q[1].filter((_, i) => i !== q[2]),
        );
      }
      break;
    }
    case 'pattern': {
      const start = int(1, 4),
        step = int(1, 3);
      const variant = loc.round % 3;
      c.data = {
        variant,
        series: Array.from({ length: 4 }, (_, i) =>
          variant === 0
            ? start + i * step
            : variant === 1
              ? (i * 90 + start * 45) % 360
              : start + i,
        ),
        step,
      };
      c.prompt =
        variant === 1
          ? 'Continue the rotation. Choose the next angle.'
          : variant === 2
            ? 'Which tile completes the matrix progression?'
            : 'Continue the dot-count pattern.';
      const correct =
        variant === 1 ? (4 * 90 + start * 45) % 360 : start + 4 * (variant === 0 ? step : 1);
      options(String(correct), [
        String(correct + step),
        String(Math.max(0, correct - step)),
        String(correct + step * 2),
      ]);
      if (variant === 2) {
        const base = int(1, 3),
          colStep = int(1, 2),
          rowStep = int(1, 2);
        c.data.matrix = Array.from(
          { length: 9 },
          (_, i) => base + (i % 3) * colStep + Math.floor(i / 3) * rowStep,
        );
        const missing = c.data.matrix[8];
        options(String(missing), [String(missing + 1), String(missing + 2), String(missing - 1)]);
      }
      break;
    }
    case 'spatial': {
      const variant = loc.round % 3;
      const angle = pick([90, 180, 270]);
      c.data = { angle, variant, mirror: r() > 0.5 };
      if (variant === 0) {
        c.prompt = `Rotate the reference shape ${angle}° clockwise. Select its orientation.`;
        c.options = ['0°', '90°', '180°', '270°'];
        answer = angle / 90;
      } else if (variant === 1) {
        c.prompt = 'Is the comparison shape a rotation or a mirror of the reference?';
        c.options = ['Rotation', 'Mirror'];
        answer = c.data.mirror ? 1 : 0;
      } else {
        const east = int(1, 4),
          north = int(1, 4);
        c.prompt = `From the center: ${north} north, ${east} east, ${north + 1} south. Where do you finish?`;
        c.data.route = { east, north };
        options(`${east} east, 1 south`, [
          `${east} west, 1 north`,
          `${east} east, 1 north`,
          `${east + 1} east, 1 south`,
        ]);
      }
      break;
    }
    case 'decision': {
      const payout = int(5, 15) * 10,
        prob = pick([30, 50, 70]);
      c.prompt = `Allocate one unit. A returns 40 points for certain. B returns ${payout} points with ${prob}% probability. Choose a policy.`;
      c.options = ['Choose certain return', 'Choose uncertain return'];
      c.data = { payout, prob, preference: true };
      answer = null;
      break;
    }
    case 'switch': {
      const square = r() > 0.5;
      const color = r() > 0.5 ? 'BLUE' : 'AMBER';
      const number = int(1, 99);
      const flip = m.id === 'adaptability' && loc.round >= Math.floor(loc.rounds / 2);
      c.data = { square, color, number, flip, rule: square ? 'COLOR' : 'PARITY' };
      c.prompt = flip
        ? 'RULE UPDATE: color labels and parity labels are now reversed.'
        : 'Square → color. Circle → odd/even.';
      c.options = ['BLUE', 'AMBER', 'ODD', 'EVEN'];
      answer = square ? (color === 'BLUE' ? 0 : 1) : number % 2 ? 2 : 3;
      if (flip) answer = answer % 2 === 0 ? answer + 1 : answer - 1;
      break;
    }
    case 'multi': {
      const a = int(2, 12),
        b = int(2, 12);
      c.data = {
        a,
        b,
        durationMs: 14000,
        events: [int(2000, 3500), int(6500, 8000), int(10500, 12000)],
        initialGauge: int(35, 65),
        drift: pick([-4, 4]),
      };
      c.prompt = 'Monitor the instrument panel for 14 seconds.';
      answer = a + b;
      break;
    }
    case 'estimate': {
      const variant = loc.round % 4;
      const count = int(14, 70);
      const angle = int(25, 160);
      const percent = int(12, 88);
      c.data = {
        variant,
        count,
        angle,
        percent,
        dots: Array.from({ length: count }, () => [r() * 90 + 5, r() * 80 + 10]),
      };
      c.prompt = [
        'Estimate the number of dots.',
        'Estimate the angle in degrees.',
        'Estimate the filled percentage.',
        'Estimate the line length as a percentage of the ruler.',
      ][variant];
      answer = variant === 0 ? count : variant === 1 ? angle : percent;
      break;
    }
    case 'interval': {
      const seconds = pick([2, 5, 8]);
      c.data = { seconds };
      c.prompt = `Reproduce ${seconds} seconds. Start, then stop when you believe the interval has elapsed.`;
      answer = seconds * 1000;
      break;
    }
    case 'motor': {
      const variant = loc.round % 4;
      c.data = {
        variant,
        targets: Array.from({ length: 5 }, () => ({ x: int(10, 90), y: int(15, 85) })),
        radius: Math.max(10, 26 - difficulty * 2),
        durationMs: 18000,
      };
      c.prompt = [
        'Hit the five target centers.',
        'Follow the route through the five numbered checkpoints.',
        'Stop the moving marker at the center.',
        'Drag the tracking puck onto each target center. Keyboard and tap placement are also available.',
      ][variant];
      answer = null;
      break;
    }
    case 'typing': {
      c.data = { passage: pick(passages), maxMs: 90000 };
      c.prompt = 'Transcribe the passage exactly.';
      answer = c.data.passage;
      break;
    }
    case 'error': {
      const rows = Array.from({ length: 6 }, (_, i) => {
        const left = `${pick(['RX', 'CT', 'AB', 'PN'])}-${int(100, 999)}-${i + 1}`;
        return { left, right: left };
      });
      const target = int(0, 5);
      rows[target].right = rows[target].left.slice(0, -1) + String(int(7, 9));
      c.data = { rows, variant: loc.round % 3 };
      answer = target;
      break;
    }
    case 'rule': {
      const divisor = int(2, 5);
      const offset = int(0, divisor - 1);
      c.data = {
        examples: Array.from({ length: 4 }, (_, i) => (i + 1) * divisor + offset),
        negative: [divisor + offset + 1, divisor * 2 + offset + 1],
      };
      c.prompt = 'Accepted and rejected examples define a rule. Which candidate is accepted?';
      options(String(divisor * int(7, 12) + offset), [
        String(divisor * 6 + offset + 1),
        String(divisor * 7 + offset + 1),
        String(divisor * 8 + offset + 1),
      ]);
      break;
    }
  }
  c.locale = locale;
  if (locale === 'uk') {
    const sourcePrompt = c.prompt;
    const sourceOptions = c.options;
    c.prompt = translate(c.prompt, locale);
    c.options = c.options?.map((value) => translate(value, locale));
    if (sourcePrompt === 'A key is to a lock as a ticket is to…')
      c.options = sourceOptions?.map((value) =>
        value === 'paper' ? 'папером' : translate(value, locale),
      );
    if (c.data.study) c.data.study = c.data.study.map((word: string) => translate(word, locale));
    if (c.data.colors)
      c.data.colors = c.data.colors.map((color: string) => translate(color, locale));
    if (c.data.word) c.data.word = translate(c.data.word, locale);
    if (c.data.passage) {
      c.data.passage = translate(c.data.passage, locale);
      answer = c.data.passage;
    }
    if (c.data.recall) answer = c.data.study.slice(0, 3).join(' ');
  }
  return { challenge: c, answer };
}
