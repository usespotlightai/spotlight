import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CountField } from '@/components/features/searches/station/CountField';
import { ObjectiveChoices } from '@/components/features/searches/station/ObjectiveChoices';
import { SearchEstimateSummary } from '@/components/features/searches/station/SearchEstimateSummary';
import { SearchWarnings } from '@/components/features/searches/station/SearchWarnings';
import { SetChoice } from '@/components/features/searches/station/SetChoice';
import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';
import { CeilingField } from '@/components/shared/form/CeilingField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useSearchEstimate } from '@/hooks/api/useSearchEstimate';
import { useStartSearch } from '@/hooks/api/useStartSearch';
import { useDebounced } from '@/hooks/useDebounced';
import {
  type ReplayedStation,
  type ReplaySet,
  USUAL_CURRENCY,
} from '@/lib/replay';
import { REPEATS_HINT, REPEATS_LABEL } from '@/lib/replay-words';
import {
  agentOf,
  type BudgetInputs,
  budgetFrom,
  DEFAULT_CONCURRENCY,
  refusalsOf,
  type SearchBudget,
  type SearchField,
  searchPath,
  setRefusal,
  typedIn,
} from '@/lib/search';
import {
  objectiveSuggestedShown,
  SEARCH_CEILING_NOTE,
  type SearchObjective,
} from '@/lib/search-words';
import { useForwardTrail } from '@/lib/trail';

const LABEL = 'font-medium text-foreground text-xs';

const ESTIMATE_MS = 400;

const FIRST_BUDGET: BudgetInputs = {
  iterations: '3',
  perIteration: '2',
  concurrency: String(DEFAULT_CONCURRENCY),
  repeats: '1',
  amount: '',
  currency: USUAL_CURRENCY,
};

type StartSearchDialogProps = {
  at: ReplayedStation;
  sets: readonly ReplaySet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const firstStartable = (sets: readonly ReplaySet[]): string =>
  sets.find((set) => setRefusal(set) === null)?.id ?? '';

export function StartSearchDialog({
  at,
  sets,
  open,
  onOpenChange,
}: StartSearchDialogProps) {
  const start = useStartSearch();
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const { data: harnesses } = useHarnesses();
  const [chosenSet, setSetId] = useState('');
  const [inputs, setInputs] = useState(FIRST_BUDGET);
  const [chosenHarness, setHarness] = useState('');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [chosenObjective, setObjective] = useState<SearchObjective | null>(
    null,
  );
  const [tried, setTried] = useState(false);

  const setId = chosenSet || firstStartable(sets);
  const harness = harnesses?.some((each) => each.id === chosenHarness)
    ? chosenHarness
    : (harnesses?.[0]?.id ?? '');

  const { budget, problems } = budgetFrom(inputs);
  const askedKey = setId && budget ? JSON.stringify({ setId, budget }) : null;
  const settledKey = useDebounced(askedKey, ESTIMATE_MS);
  const settled = useMemo(
    () =>
      settledKey
        ? (JSON.parse(settledKey) as { setId: string; budget: SearchBudget })
        : null,
    [settledKey],
  );
  const estimate = useSearchEstimate(at, open ? settled : null);
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

  const forget = () => {
    setSetId('');
    setInputs(FIRST_BUDGET);
    setHarness('');
    setModel('');
    setEffort('');
    setObjective(null);
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

  const ceilingProblem = shown('ceiling');
  const suggested = estimate.data && !estimate.isError ? estimate.data : null;
  const askedObjective = chosenObjective ?? suggested?.objective ?? null;
  const chosenSetSaturation =
    sets.find((each) => each.id === setId)?.health.saturation ?? null;
  const objective =
    askedObjective ?? (chosenSetSaturation?.saturated ? 'cost' : 'success');
  const saturatedWarning = suggested?.warnings.find(
    (warning) => warning.kind === 'saturated',
  );
  const saturatedRate =
    saturatedWarning?.kind === 'saturated'
      ? saturatedWarning.rate
      : chosenSetSaturation?.saturated
        ? chosenSetSaturation.rate
        : null;
  const agentProblem = shown('agent');
  const setProblem =
    shown('set') ?? (tried && !setId ? 'Choose a replay set.' : null);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settledOpen) => !settledOpen && forget()}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Start a search</DialogTitle>
          <DialogDescription>
            An agent proposes changed configs for this station, and each is
            replayed on most of the set’s tasks. The best are then replayed on
            the tasks it never saw, to check they hold up. Nothing is applied
            until you pick one.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <fieldset className="flex flex-col gap-1.5">
            <legend className={`${LABEL} mb-1.5`}>Search on</legend>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {sets.map((set) => (
                <SetChoice
                  key={set.id}
                  set={set}
                  checked={set.id === setId}
                  disabled={start.isPending}
                  onChange={(next) => {
                    setSetId(next);
                    start.reset();
                  }}
                />
              ))}
            </div>
            {setProblem && (
              <p role="alert" className="text-destructive text-xs">
                {setProblem}
              </p>
            )}
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CountField
              label="Iterations"
              hint="How many times its agent runs, 1 to 10."
              value={inputs.iterations}
              problem={shown('iterations')}
              disabled={start.isPending}
              onChange={change('iterations')}
            />
            <CountField
              label="Candidates per iteration"
              hint="How many each agent run may propose, 1 to 5."
              value={inputs.perIteration}
              problem={shown('perIteration')}
              disabled={start.isPending}
              onChange={change('perIteration')}
            />
            <CountField
              label="At once"
              hint="Replay runs it runs together, 1 to 10."
              value={inputs.concurrency}
              problem={shown('concurrency')}
              disabled={start.isPending}
              onChange={change('concurrency')}
            />
            <CountField
              label={REPEATS_LABEL}
              hint={REPEATS_HINT}
              value={inputs.repeats}
              problem={shown('repeats')}
              disabled={start.isPending}
              onChange={change('repeats')}
            />
          </div>

          <CeilingField
            amount={inputs.amount}
            currency={inputs.currency}
            onAmount={change('amount')}
            onCurrency={change('currency')}
            placeholder="20.00"
            disabled={start.isPending}
            problem={ceilingProblem}
            note={SEARCH_CEILING_NOTE}
          />

          <ObjectiveChoices
            value={objective}
            onChange={(next) => {
              setObjective(next);
              start.reset();
            }}
            disabled={start.isPending}
            suggestion={
              chosenObjective === null && saturatedRate !== null
                ? objectiveSuggestedShown(saturatedRate)
                : null
            }
          />

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Its agent</span>
            <div className="-ml-2 flex flex-wrap items-center">
              <HarnessSelect
                value={harness}
                onChange={(next) => {
                  setHarness(next);
                  setModel('');
                  setEffort('');
                  start.reset();
                }}
                allowNone={false}
                readOnly={start.isPending}
                className="w-auto"
              />
              <ModelEffortSelect
                harness={harness}
                model={model}
                onModel={(next) => {
                  setModel(next);
                  start.reset();
                }}
                effort={effort}
                onEffort={(next) => {
                  setEffort(next);
                  start.reset();
                }}
                readOnly={start.isPending}
                iconless
                className="w-auto"
              />
            </div>
            {agentProblem && (
              <p role="alert" className="text-destructive text-xs">
                {agentProblem}
              </p>
            )}
          </div>

          <SearchEstimateSummary
            estimate={estimate.data}
            repeats={settled?.budget.repeats ?? 1}
            asked={settled !== null}
            estimating={estimate.isFetching}
            refusal={
              estimate.isError
                ? (estimateRefusals.general ??
                  'Fix the field marked above to see an estimate.')
                : null
            }
          />

          {estimate.data && !estimate.isError && (
            <SearchWarnings
              warnings={estimate.data.warnings}
              repeats={budget?.repeats ?? null}
              onUseRepeats={(next) => change('repeats')(String(next))}
              disabled={start.isPending}
            />
          )}

          {startRefusals.general && (
            <p role="alert" className="text-destructive text-xs">
              {startRefusals.general}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={start.isPending || !harness}
            >
              {start.isPending ? 'Starting…' : 'Start search'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
