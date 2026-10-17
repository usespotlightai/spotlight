import type { HarnessResponseDto } from '@/lib/api';
import { type ReplaySet, USUAL_CURRENCY } from '@/lib/replay';
import {
  type BudgetInputs,
  DEFAULT_CONCURRENCY,
  type FieldProblems,
  type SearchBudget,
  type SearchEstimate,
  type SearchField,
  setRefusal,
  typedIn,
} from '@/lib/search';
import {
  formatObjectiveSuggested,
  type SearchObjective,
} from '@/lib/search-words';

type SetSaturation = ReplaySet['health']['saturation'];

export type EstimateAsked = {
  readonly setId: string;
  readonly budget: SearchBudget;
};

export type SearchProblemSources = {
  readonly problems: FieldProblems;
  readonly inputs: BudgetInputs;
  readonly tried: boolean;
  readonly refused: readonly FieldProblems[];
};

export const FIRST_BUDGET: BudgetInputs = {
  iterations: '3',
  perIteration: '2',
  concurrency: String(DEFAULT_CONCURRENCY),
  repeats: '1',
  amount: '',
  currency: USUAL_CURRENCY,
};

export const NO_SET_CHOSEN = 'Choose a replay set.';

const NO_ESTIMATE = 'Please fix the marked field to see an estimate.';

export const firstStartable = (sets: readonly ReplaySet[]): string =>
  sets.find((set) => setRefusal(set) === null)?.id ?? '';

export const harnessOf = (
  harnesses: readonly HarnessResponseDto[] | undefined,
  chosen: string,
): string =>
  harnesses?.some((each) => each.id === chosen)
    ? chosen
    : (harnesses?.[0]?.id ?? '');

export const estimateKey = (
  setId: string,
  budget: SearchBudget | null,
): string | null =>
  setId && budget ? JSON.stringify({ setId, budget }) : null;

export const estimateAskedOf = (key: string | null): EstimateAsked | null =>
  key ? (JSON.parse(key) as EstimateAsked) : null;

export const searchProblemOf = (
  field: SearchField,
  { problems, inputs, tried, refused }: SearchProblemSources,
): string | null => {
  const local = problems[field];

  if (local && (tried || typedIn(inputs, field))) {
    return local;
  }

  return (
    refused
      .map((fields) => fields[field])
      .find((problem) => problem !== undefined) ?? null
  );
};

export const saturationOf = (
  sets: readonly ReplaySet[],
  setId: string,
): SetSaturation =>
  sets.find((each) => each.id === setId)?.health.saturation ?? null;

export const objectiveOf = (
  asked: SearchObjective | null,
  saturation: SetSaturation,
): SearchObjective => asked ?? (saturation?.saturated ? 'cost' : 'success');

export const saturatedRateOf = (
  suggested: SearchEstimate | null,
  saturation: SetSaturation,
): number | null => {
  const warning = suggested?.warnings.find((each) => each.kind === 'saturated');

  if (warning?.kind === 'saturated') {
    return warning.rate;
  }

  return saturation?.saturated ? saturation.rate : null;
};

export const objectiveSuggestionOf = (
  chosen: SearchObjective | null,
  saturatedRate: number | null,
): string | null =>
  chosen === null && saturatedRate !== null
    ? formatObjectiveSuggested(saturatedRate)
    : null;

export const estimateRefusalOf = (
  refused: boolean,
  general: string | null,
): string | null => (refused ? (general ?? NO_ESTIMATE) : null);
