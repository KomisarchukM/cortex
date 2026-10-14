import type { Locale } from './model.js';
import { uk } from './uk.js';
import './uk-tasks.js';
export function translate(value: string, locale: Locale = 'en'): string {
  if (locale === 'en') return value;
  const key = value.trim().replace(/\s+/g, ' ');
  const translated = uk[key];
  if (translated !== undefined)
    return (
      value.slice(0, value.indexOf(value.trimStart())) +
      translated +
      value.slice(value.trimEnd().length)
    );
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^Approximately (\d+) minutes$/, (m) => `Приблизно ${m[1]} хвилин`],
    [/^(\d+) dimensions · (\d+) trials each$/, (m) => `${m[1]} напрямів · ${m[2]} спроб на кожен`],
    [
      /^(accuracy|confidence|latency) by trial block, from ([\d.]+) to ([\d.]+)$/,
      (m) =>
        `${m[1] === 'accuracy' ? 'Точність' : m[1] === 'confidence' ? 'Впевненість' : 'Час відповіді'} за блоками спроб: від ${m[2]} до ${m[3]}`,
    ],
    [/^(\d+) ms$/, (m) => `${m[1]} мс`],
    [/^(\d+) ms²$/, (m) => `${m[1]} мс²`],
    [/^(\d+) WPM$/, (m) => `${m[1]} слів/хв`],
    [/^([−+]?\d+) points$/, (m) => `${m[1]} балів`],
    [/^Find (.+) among the (.+) symbols\.$/, (m) => `Знайдіть ${m[1]} серед символів ${m[2]}.`],
    [/^What is (\d+)% of (\d+)\?$/, (m) => `Скільки становить ${m[1]}% від ${m[2]}?`],
    [
      /^A box contains (\d+) blue and (\d+) white tiles\. What percentage are blue\?$/,
      (m) => `У коробці ${m[1]} синіх і ${m[2]} білих плиток. Який відсоток плиток сині?`,
    ],
    [
      /^The ratio of small to large parts is 2:3\. There are (\d+) small parts\. How many large parts\?$/,
      (m) => `Відношення малих деталей до великих — 2:3. Малих деталей ${m[1]}. Скільки великих?`,
    ],
    [
      /^Every (copper|round|marked) token is in tray A\. No token in tray A is damaged\. Which conclusion must hold\?$/,
      (m) =>
        `Кожен ${m[1] === 'copper' ? 'мідний' : m[1] === 'round' ? 'круглий' : 'позначений'} жетон у лотку A. Жоден жетон у лотку A не пошкоджений. Який висновок правильний?`,
    ],
    [
      /^A counter doubles, then adds (\d+) each step\. Starting at 1, the first two values are (\d+) and (\d+)\. What is next\?$/,
      (m) =>
        `На кожному кроці лічильник подвоюється, а потім додає ${m[1]}. Починаючи з 1, перші два значення — ${m[2]} і ${m[3]}. Яке наступне?`,
    ],
    [
      /^Rotate the reference shape (\d+)° clockwise\. Select its orientation\.$/,
      (m) =>
        `Поверніть еталонну фігуру на ${m[1]}° за годинниковою стрілкою. Оберіть її орієнтацію.`,
    ],
    [
      /^From the center: (\d+) north, (\d+) east, (\d+) south\. Where do you finish\?$/,
      (m) => `Від центра: ${m[1]} на північ, ${m[2]} на схід, ${m[3]} на південь. Де ви опинитеся?`,
    ],
    [
      /^(\d+) (east|west), 1 (south|north)$/,
      (m) =>
        `${m[1]} на ${m[2] === 'east' ? 'схід' : 'захід'}, 1 на ${m[3] === 'south' ? 'південь' : 'північ'}`,
    ],
    [
      /^Allocate one unit\. A returns 40 points for certain\. B returns (\d+) points with (\d+)% probability\. Choose a policy\.$/,
      (m) =>
        `Розподіліть одну одиницю ресурсу. A гарантовано дає 40 балів. B дає ${m[1]} балів з імовірністю ${m[2]}%. Оберіть стратегію.`,
    ],
    [
      /^Reproduce (\d+) seconds\. Start, then stop when you believe the interval has elapsed\.$/,
      (m) =>
        `Відтворіть інтервал у ${m[1]} с. Почніть, а потім зупиніться, коли, на вашу думку, час мине.`,
    ],
    [/^(\d+) seconds$/, (m) => `${m[1]} с`],
    [/^(\d+) ms scheduling range$/, (m) => `Діапазон планування: ${m[1]} мс`],
    [/^Cell (\d+)$/, (m) => `Клітинка ${m[1]}`],
    [/^Position (\d+)$/, (m) => `Позиція ${m[1]}`],
    [/^Symbol (\d+): (.+)$/, (m) => `Символ ${m[1]}: ${m[2]}`],
    [/^CHECKPOINT \/ (\d+) OF 5$/, (m) => `КОНТРОЛЬНА ТОЧКА / ${m[1]} ІЗ 5`],
    [/^(.+) · Session (.+)$/, (m) => `${m[1]} · Сесія ${m[2]}`],
    [/^(.+) · Assessment complete\.$/, (m) => `${m[1]} · Тестування завершено.`],
    [/^Trial (\d+)$/, (m) => `Спроба ${m[1]}`],
  ];
  for (const [pattern, format] of patterns) {
    const match = key.match(pattern);
    if (match) return format(match);
  }
  return value;
}
