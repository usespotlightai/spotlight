import { type FormEvent, useState } from 'react';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useStartSearch } from '@/hooks/api/useStartSearch';
import { useFollowStarted } from '@/hooks/useFollowStarted';
import { useSettledSearchEstimate } from '@/hooks/useSettledSearchEstimate';
import { andReset } from '@/lib/and-reset';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import {
  agentOf,
  type BudgetInputs,
  budgetFrom,
  refusalsOf,
  type SearchField,
  searchPath,
} from '@/lib/search';
import {
  estimateRefusalOf,
  FIRST_BUDGET,
  firstStartable,
  harnessOf,
  NO_SET_CHOSEN,
  objectiveOf,
  objectiveSuggestionOf,
  saturatedRateOf,
  saturationOf,
  searchProblemOf,
} from '@/lib/search-start';
import type { SearchObjective } from '@/lib/search-words';

type StartSearchFormOptions = {
  at: ReplayedStation;
  sets: readonly ReplaySet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function useStartSearchForm({
  at,
  sets,
  open,
  onOpenChange,
}: StartSearchFormOptions) {
  const start = useStartSearch();
  const followStarted = useFollowStarted(onOpenChange);
  const { data: harnesses } = useHarnesses();
  const [chosenSet, setChosenSet] = useState('');
  const [inputs, setInputs] = useState(FIRST_BUDGET);
  const [chosenHarness, setChosenHarness] = useState('');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [chosenObjective, setChosenObjective] =
    useState<SearchObjective | null>(null);
  const [tried, setTried] = useState(false);

  const setId = chosenSet || firstStartable(sets);
  const harness = harnessOf(harnesses, chosenHarness);
  const { budget, problems } = budgetFrom(inputs);
  const { settled, estimate } = useSettledSearchEstimate(
    at,
    open,
    setId,
    budget,
  );
  const estimateRefusals = refusalsOf(estimate.error);
  const startRefusals = refusalsOf(start.error);
  const suggested = estimate.isError ? null : (estimate.data ?? null);
  const saturation = saturationOf(sets, setId);
  const askedObjective = chosenObjective ?? suggested?.objective ?? null;

  const shown = (field: SearchField): string | null =>
    searchProblemOf(field, {
      problems,
      inputs,
      tried,
      refused: [startRefusals.fields, estimateRefusals.fields],
    });

  const change = (field: keyof BudgetInputs) =>
    andReset(
      (value: string) => setInputs((was) => ({ ...was, [field]: value })),
      start.reset,
    );

  const chooseHarness = andReset((next: string) => {
    setChosenHarness(next);
    setModel('');
    setEffort('');
  }, start.reset);

  const forget = () => {
    setChosenSet('');
    setInputs(FIRST_BUDGET);
    setChosenHarness('');
    setModel('');
    setEffort('');
    setChosenObjective(null);
    setTried(false);
    start.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);

    if (!setId || !budget || !harness || start.isPending) {
      return;
    }

    start.mutate(
      {
        at,
        setId,
        budget,
        agent: agentOf(harness, model, effort),
        objective: askedObjective,
      },
      { onSuccess: (started) => followStarted(searchPath(at, started.id)) },
    );
  };

  return {
    setId,
    inputs,
    harness,
    model,
    effort,
    objective: objectiveOf(askedObjective, saturation),
    objectiveSuggestion: objectiveSuggestionOf(
      chosenObjective,
      saturatedRateOf(suggested, saturation),
    ),
    budget,
    settled,
    estimate,
    suggested,
    pending: start.isPending,
    shown,
    setProblem: shown('set') ?? (tried && !setId ? NO_SET_CHOSEN : null),
    estimateRefusal: estimateRefusalOf(
      estimate.isError,
      estimateRefusals.general,
    ),
    change,
    chooseSet: andReset(setChosenSet, start.reset),
    chooseObjective: andReset(setChosenObjective, start.reset),
    chooseHarness,
    chooseModel: andReset(setModel, start.reset),
    chooseEffort: andReset(setEffort, start.reset),
    forget,
    submit,
  };
}
