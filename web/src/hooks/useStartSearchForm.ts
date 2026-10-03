import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useStartSearch } from '@/hooks/api/useStartSearch';
import { useSettledSearchEstimate } from '@/hooks/useSettledSearchEstimate';
import {
  type ReplayedStation,
  type ReplaySet,
  USUAL_CURRENCY,
} from '@/lib/replay';
import {
  agentOf,
  type BudgetInputs,
  budgetFrom,
  DEFAULT_CONCURRENCY,
  refusalsOf,
  type SearchField,
  searchPath,
  setRefusal,
  typedIn,
} from '@/lib/search';
import { useForwardTrail } from '@/lib/trail';

const FIRST_BUDGET: BudgetInputs = {
  iterations: '3',
  perIteration: '2',
  concurrency: String(DEFAULT_CONCURRENCY),
  amount: '',
  currency: USUAL_CURRENCY,
};

const firstStartable = (sets: readonly ReplaySet[]): string =>
  sets.find((set) => setRefusal(set) === null)?.id ?? '';

type StartSearchFormOf = {
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
}: StartSearchFormOf) {
  const start = useStartSearch();
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const { data: harnesses } = useHarnesses();
  const [chosenSet, setSetId] = useState('');
  const [inputs, setInputs] = useState(FIRST_BUDGET);
  const [chosenHarness, setHarness] = useState('');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [tried, setTried] = useState(false);

  const setId = chosenSet || firstStartable(sets);
  const harness = harnesses?.some((each) => each.id === chosenHarness)
    ? chosenHarness
    : (harnesses?.[0]?.id ?? '');

  const { budget, problems } = budgetFrom(inputs);
  const { settled, estimate } = useSettledSearchEstimate(
    at,
    setId,
    budget,
    open,
  );
  const estimateRefusals = refusalsOf(estimate.error);
  const startRefusals = refusalsOf(start.error);

  const shown = (field: SearchField): string | null => {
    const local = problems[field];

    return (
      (local && (tried || typedIn(inputs, field)) ? local : null) ??
      startRefusals.fields[field] ??
      estimateRefusals.fields[field] ??
      null
    );
  };

  const change = (field: keyof BudgetInputs) => (value: string) => {
    setInputs((was) => ({ ...was, [field]: value }));
    start.reset();
  };

  const chooseSet = (next: string) => {
    setSetId(next);
    start.reset();
  };

  const chooseHarness = (next: string) => {
    setHarness(next);
    setModel('');
    setEffort('');
    start.reset();
  };

  const chooseModel = (next: string) => {
    setModel(next);
    start.reset();
  };

  const chooseEffort = (next: string) => {
    setEffort(next);
    start.reset();
  };

  const forget = () => {
    setSetId('');
    setInputs(FIRST_BUDGET);
    setHarness('');
    setModel('');
    setEffort('');
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
      { at, setId, budget, agent: agentOf(harness, model, effort) },
      {
        onSuccess: (started) => {
          onOpenChange(false);
          navigate(searchPath(at, started.id), {
            state: trail.length > 0 ? { trail } : undefined,
          });
        },
      },
    );
  };

  const setProblem =
    shown('set') ?? (tried && !setId ? 'Choose a replay set.' : null);

  return {
    setId,
    inputs,
    harness,
    model,
    effort,
    starting: start.isPending,
    settled,
    estimate,
    estimateRefusal: estimateRefusals.general,
    startRefusal: startRefusals.general,
    setProblem,
    shown,
    change,
    chooseSet,
    chooseHarness,
    chooseModel,
    chooseEffort,
    forget,
    submit,
  };
}
