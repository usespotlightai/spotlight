import { ObjectiveChoices } from '@/components/features/searches/station/ObjectiveChoices';
import { SearchAgentField } from '@/components/features/searches/station/SearchAgentField';
import { SearchBudgetCounts } from '@/components/features/searches/station/SearchBudgetCounts';
import { SearchEstimateSummary } from '@/components/features/searches/station/SearchEstimateSummary';
import { SearchSetField } from '@/components/features/searches/station/SearchSetField';
import { SearchWarnings } from '@/components/features/searches/station/SearchWarnings';
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
import { useStartSearchForm } from '@/hooks/useStartSearchForm';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import { SEARCH_CEILING_NOTE } from '@/lib/search-words';

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
            An agent proposes configs for this station. Each config replays on
            most of the set’s tasks. Then the best configs replay on held-out
            tasks to check that they still do well. The station doesn’t change
            until you pick a config.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.submit} className="contents">
          <SearchSetField
            sets={sets}
            setId={form.setId}
            problem={form.setProblem}
            disabled={form.pending}
            onChange={form.chooseSet}
          />

          <SearchBudgetCounts
            inputs={form.inputs}
            problemOf={form.shown}
            disabled={form.pending}
            onChange={form.change}
          />

          <CeilingField
            amount={form.inputs.amount}
            currency={form.inputs.currency}
            onAmount={form.change('amount')}
            onCurrency={form.change('currency')}
            placeholder="20.00"
            disabled={form.pending}
            problem={form.shown('ceiling')}
            note={SEARCH_CEILING_NOTE}
          />

          <ObjectiveChoices
            value={form.objective}
            onChange={form.chooseObjective}
            disabled={form.pending}
            suggestion={form.objectiveSuggestion}
          />

          <SearchAgentField
            harness={form.harness}
            model={form.model}
            effort={form.effort}
            onHarness={form.chooseHarness}
            onModel={form.chooseModel}
            onEffort={form.chooseEffort}
            problem={form.shown('agent')}
            disabled={form.pending}
          />

          <SearchEstimateSummary
            estimate={form.estimate.data}
            repeats={form.settled?.budget.repeats ?? 1}
            asked={form.settled !== null}
            estimating={form.estimate.isFetching}
            refusal={form.estimateRefusal}
          />

          {form.suggested && (
            <SearchWarnings
              warnings={form.suggested.warnings}
              repeats={form.budget?.repeats ?? null}
              onUseRepeats={(next) => form.change('repeats')(String(next))}
              disabled={form.pending}
            />
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={form.pending || !form.harness}
            >
              {form.pending ? 'Starting…' : 'Start search'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
