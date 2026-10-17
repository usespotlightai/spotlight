import type { MeasureVerdictResponseDto } from '@/lib/api';
import { amountIn } from '@/lib/inbox';
import {
  changeDelta,
  type Delta,
  formatCount,
  formatShare,
} from '@/lib/insights';
import { alertMeasureLabel } from '@/lib/station-watch';

export type MeasureVerdict = MeasureVerdictResponseDto;

export type ComparedRow = {
  readonly id: string;
  readonly label: string;
  readonly one: string;
  readonly other: string;
  readonly delta: Delta | null;
  readonly note?: string;
  readonly to?: string;
};

const TONES: Record<MeasureVerdict['verdict'], Delta['tone']> = {
  better: 'good',
  worse: 'bad',
  unchanged: 'flat',
  insufficient: 'flat',
};

const formatValue = (verdict: MeasureVerdict, value: number | null): string => {
  if (value === null) {
    return '–';
  }

  return verdict.measure === 'cost_per_run'
    ? amountIn(value, verdict.currency)
    : formatShare(value);
};

const verdictDelta = (verdict: MeasureVerdict): Delta => {
  if (verdict.verdict === 'insufficient') {
    return { shown: 'Too few runs', tone: 'flat' };
  }

  const moved = changeDelta(verdict.change);

  return {
    shown:
      verdict.verdict === 'unchanged' || !moved ? 'No change' : moved.shown,
    tone: TONES[verdict.verdict],
  };
};

export const comparedRows = (
  runs: { readonly one: number; readonly other: number },
  verdicts: readonly MeasureVerdict[],
): ComparedRow[] => [
  {
    id: 'runs',
    label: 'Runs',
    one: formatCount(runs.one),
    other: formatCount(runs.other),
    delta: null,
  },
  ...verdicts.map((verdict) => ({
    id: verdict.measure,
    label: alertMeasureLabel(verdict.measure),
    one: formatValue(verdict, verdict.before),
    other: formatValue(verdict, verdict.after),
    delta: verdictDelta(verdict),
  })),
];
