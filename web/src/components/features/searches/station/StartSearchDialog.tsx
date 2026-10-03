import { CeilingField } from '@/components/features/searches/station/CeilingField';
import { CountField } from '@/components/features/searches/station/CountField';
import { SearchAgentField } from '@/components/features/searches/station/SearchAgentField';
import { SearchEstimateSummary } from '@/components/features/searches/station/SearchEstimateSummary';
import { SearchSetField } from '@/components/features/searches/station/SearchSetField';
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
import { useStartSearchForm } from '@/hooks/useStartSearchForm';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';

type StartSearchDialogProps = {
  at: ReplayedStation;
  sets: readonly ReplaySet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StartSearchDialog({
  at,
  sets,
  open,
  onOpenChange,
}: StartSearchDialogProps) {
  const form = useStartSearchForm({ at, sets, open, onOpenChange });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settledOpen) => !settledOpen && form.forget()}
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

        <form onSubmit={form.submit} className="contents">
          <SearchSetField
            sets={sets}
            setId={form.setId}
            problem={form.setProblem}
            disabled={form.starting}
            onChange={form.chooseSet}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CountField
              label="Iterations"
              hint="How many times its agent runs, 1 to 10."
              value={form.inputs.iterations}
              problem={form.shown('iterations')}
              disabled={form.starting}
              onChange={form.change('iterations')}
            />
            <CountField
              label="Candidates per iteration"
              hint="How many each agent run may propose, 1 to 5."
              value={form.inputs.perIteration}
              problem={form.shown('perIteration')}
              disabled={form.starting}
              onChange={form.change('perIteration')}
            />
            <CountField
              label="At once"
              hint="Replay runs it runs together, 1 to 10."
              value={form.inputs.concurrency}
              problem={form.shown('concurrency')}
              disabled={form.starting}
              onChange={form.change('concurrency')}
            />
          </div>

          <CeilingField
            amount={form.inputs.amount}
            currency={form.inputs.currency}
            problem={form.shown('ceiling')}
            disabled={form.starting}
            onAmount={form.change('amount')}
            onCurrency={form.change('currency')}
          />

          <SearchAgentField
            harness={form.harness}
            model={form.model}
            effort={form.effort}
            problem={form.shown('agent')}
            readOnly={form.starting}
            onHarness={form.chooseHarness}
            onModel={form.chooseModel}
            onEffort={form.chooseEffort}
          />

          <SearchEstimateSummary
            estimate={form.estimate.data}
            asked={form.settled !== null}
            estimating={form.estimate.isFetching}
            refusal={
              form.estimate.isError
                ? (form.estimateRefusal ??
                  'Fix the field marked above to see an estimate.')
                : null
            }
          />

          {form.startRefusal && (
            <p role="alert" className="text-destructive text-xs">
              {form.startRefusal}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={form.starting || !form.harness}
            >
              {form.starting ? 'Starting…' : 'Start search'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
