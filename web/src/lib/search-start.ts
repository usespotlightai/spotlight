import type { HarnessResponseDto } from '@/lib/api';
import { type ReplaySet, USUAL_CURRENCY } from '@/lib/replay';
import {
  type BudgetInputs,
  DEFAULT_CONCURRENCY,
  type FieldProblems,
  type SearchBudget,
  type SearchEstimate,
  type SearchField,
  typedIn,
} from '@/lib/search';
import {
  formatObjectiveSuggested,
  type SearchObjective,
} from '@/lib/search-words';

type SetSaturation = ReplaySet['health']['saturation'];

export type EstimateInput = {
  readonly setId: string;
  readonly budget: SearchBudget;
};

export type SearchProblemSources = {
  readonly problems: FieldProblems;
  readonly inputs: BudgetInputs;
  readonly tried: boolean;
  readonly rejected: readonly FieldProblems[];
};

export const FIRST_BUDGET: BudgetInputs = {
  iterations: '3',
  perIteration: '2',
  concurrency: String(DEFAULT_CONCURRENCY),
  repeats: '1',
  amount: '',
  currency: USUAL_CURRENCY,
};

const NO_ESTIMATE = 'Please fix the marked field to see an estimate.';

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

export const estimateInputOf = (key: string | null): EstimateInput | null =>
  key ? (JSON.parse(key) as EstimateInput) : null;

export const searchProblemOf = (
  field: SearchField,
  { problems, inputs, tried, rejected }: SearchProblemSources,
): string | null => {
  const local = problems[field];

  if (local && (tried || typedIn(inputs, field))) {
    return local;
  }

  return (
    rejected
      .map((fields) => fields[field])
      .find((problem) => problem !== undefined) ?? null
  );
};

export const objectiveOf = (
  requested: SearchObjective | null,
  saturation: SetSaturation,
): SearchObjective => requested ?? (saturation?.saturated ? 'cost' : 'success');

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

export const estimateProblemOf = (
  rejected: boolean,
  general: string | null,
): string | null => (rejected ? (general ?? NO_ESTIMATE) : null);
