import { type FormEvent, useState } from 'react';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useStartSearch } from '@/hooks/api/useStartSearch';
import { useDebouncedSearchEstimate } from '@/hooks/useDebouncedSearchEstimate';
import { useFollowStarted } from '@/hooks/useFollowStarted';
import { andReset } from '@/lib/and-reset';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import {
  agentOf,
  type BudgetInputs,
  budgetFrom,
  problemsOf,
  type SearchField,
  searchPath,
  setProblemOf,
} from '@/lib/search';
import {
  estimateProblemOf,
  FIRST_BUDGET,
  harnessOf,
  objectiveOf,
  objectiveSuggestionOf,
  saturatedRateOf,
  searchProblemOf,
} from '@/lib/search-start';
import type { SearchObjective } from '@/lib/search-words';

type StartSearchFormOptions = {
  at: ReplayedStation;
  set: ReplaySet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function useStartSearchForm({
  at,
  set,
  open,
  onOpenChange,
}: StartSearchFormOptions) {
  const start = useStartSearch();
  const followStarted = useFollowStarted(onOpenChange);
  const { data: harnesses } = useHarnesses();
  const [inputs, setInputs] = useState(FIRST_BUDGET);
  const [chosenHarness, setChosenHarness] = useState('');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [chosenObjective, setChosenObjective] =
    useState<SearchObjective | null>(null);
  const [tried, setTried] = useState(false);

  const setId = set.id;
  const harness = harnessOf(harnesses, chosenHarness);
  const { budget, problems } = budgetFrom(inputs);
  const { debounced, estimate } = useDebouncedSearchEstimate(
    at,
    open,
    setId,
    budget,
  );
  const estimateProblems = problemsOf(estimate.error);
  const startProblems = problemsOf(start.error);
  const suggested = estimate.isError ? null : (estimate.data ?? null);
  const saturation = set.health.saturation;
  const requestedObjective = chosenObjective ?? suggested?.objective ?? null;

  const shown = (field: SearchField): string | null =>
    searchProblemOf(field, {
      problems,
      inputs,
      tried,
      rejected: [startProblems.fields, estimateProblems.fields],
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

  const reset = () => {
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

    if (!budget || !harness || start.isPending) {
      return;
    }

    start.mutate(
      {
        at,
        setId,
        budget,
        agent: agentOf(harness, model, effort),
        objective: requestedObjective,
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
    objective: objectiveOf(requestedObjective, saturation),
    objectiveSuggestion: objectiveSuggestionOf(
      chosenObjective,
      saturatedRateOf(suggested, saturation),
    ),
    budget,
    debounced,
    estimate,
    suggested,
    pending: start.isPending,
    shown,
    setProblem: shown('set') ?? setProblemOf(set),
    estimateProblem: estimateProblemOf(
      estimate.isError,
      estimateProblems.general,
    ),
    change,
    chooseObjective: andReset(setChosenObjective, start.reset),
    chooseHarness,
    chooseModel: andReset(setModel, start.reset),
    chooseEffort: andReset(setEffort, start.reset),
    reset,
    submit,
  };
}
