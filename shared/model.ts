export type Locale = 'en' | 'uk';
export type Family =
  | 'reaction'
  | 'grid'
  | 'span'
  | 'sequence'
  | 'recognition'
  | 'search'
  | 'stroop'
  | 'match'
  | 'choice'
  | 'pattern'
  | 'spatial'
  | 'decision'
  | 'switch'
  | 'multi'
  | 'estimate'
  | 'interval'
  | 'motor'
  | 'typing'
  | 'error'
  | 'rule';
export interface Module {
  id: string;
  name: string;
  category: string;
  family: Family;
  instructions: string;
  seconds: number;
  adaptive: boolean;
}
export interface PlanBlock {
  moduleId: string;
  rounds: number;
}
export type Mode = 'quick' | 'standard' | 'comprehensive' | 'extended' | 'custom';
export interface Challenge {
  locale?: Locale;
  index: number;
  moduleId: string;
  family: Family;
  difficulty: number;
  prompt: string;
  options?: string[];
  data: Record<string, any>;
  budgetMs: number;
}
export interface Answer {
  index: number;
  value: any;
  elapsedMs: number;
  confidence: number;
  skipped?: boolean;
  falseStart?: boolean;
  corrections?: number;
}
export interface ResponseRecord extends Answer {
  moduleId: string;
  difficulty: number;
  score: number;
  correct: boolean;
  createdAt: string;
  condition?: string;
  spanLength?: number;
}
export interface Metrics {
  index: number;
  percentile: number;
  accuracy: number;
  medianReactionMs: number;
  reactionVariance: number;
  falseStartRate: number;
  memorySpan: number;
  switchCostMs: number;
  precision: number;
  completion: number;
  calibration: number;
  consistency: number;
  fatigue: number;
  wpm: number;
  corrections: number;
  categories: Record<string, number>;
  timeline: { trial: number; accuracy: number; latency: number; confidence: number }[];
  distribution: number[];
  strengths: string[];
  weaknesses: string[];
  classification: string;
  recommendation: string;
  labels: Record<string, string>;
}
export type Override = {
  mode: 'real' | 'manual' | 'preset' | 'scripted';
  values: Partial<Metrics>;
};
export interface Profile {
  id: string;
  name: string;
  override: Override;
  release: 'auto' | 'hold';
  reveal: 'immediate' | 'delay' | 'manual' | 'disabled';
  revealDelaySeconds: number;
}
export interface Participant {
  locale?: Locale;
  id: string;
  alias: string;
  mode: Mode;
  seed: string;
  startedAt: string;
  status: 'active' | 'paused' | 'complete';
  cursor: number;
  total: number;
  difficulty: number;
  plan: PlanBlock[];
  metrics?: Metrics;
  released: boolean;
  revealed: boolean;
  elapsedMs: number;
}
export const modes: Record<
  Exclude<Mode, 'custom'>,
  { name: string; minutes: number; description: string }
> = {
  quick: {
    name: 'Quick Diagnostic',
    minutes: 10,
    description: 'A focused introduction to seven core dimensions.',
  },
  standard: {
    name: 'Standard Assessment',
    minutes: 30,
    description: 'A balanced survey of the complete battery.',
  },
  comprehensive: {
    name: 'Comprehensive Assessment',
    minutes: 60,
    description: 'Deeper adaptive sampling across every dimension.',
  },
  extended: {
    name: 'Extended Research Battery',
    minutes: 105,
    description: 'The full protocol. Repeated measures. Unreasonable thoroughness.',
  },
};
