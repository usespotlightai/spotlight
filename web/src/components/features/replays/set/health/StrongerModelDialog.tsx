import { StrongerModelField } from '@/components/features/replays/set/health/StrongerModelField';
import { CountField } from '@/components/features/searches/station/CountField';
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
import { useStrongerModelForm } from '@/hooks/useStrongerModelForm';
import { CANCEL } from '@/lib/form-words';
import type { ReplayedStation, ReplaySet, StationLive } from '@/lib/replay';
import {
  REPEATS_HINT,
  REPEATS_LABEL,
  START_STRONGER,
  STARTING,
  STRONGER_CEILING_NOTE,
  STRONGER_MODEL_NOTE,
  strongerTitleShown,
} from '@/lib/replay-words';
import type { StrongerSeed } from '@/lib/stronger-model';

type StrongerModelDialogProps = {
  at: ReplayedStation;
  set: ReplaySet;
  live: StationLive & { readonly harness: string };
  seed: StrongerSeed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StrongerModelDialog({
  at,
  set,
  live,
  seed,
  open,
  onOpenChange,
}: StrongerModelDialogProps) {
  const form = useStrongerModelForm({ at, set, live, seed, onOpenChange });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && form.forget()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{strongerTitleShown(set.name)}</DialogTitle>
          <DialogDescription>{STRONGER_MODEL_NOTE}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.submit} className="contents">
          <StrongerModelField
            live={live}
            harnesses={form.harnesses}
            offer={form.offer}
            offerRead={form.offerRead}
            model={form.model}
            effort={form.effort}
            onModel={form.chooseModel}
            onEffort={form.chooseEffort}
            problem={form.modelProblem}
            disabled={form.pending}
          />

          <CountField
            label={REPEATS_LABEL}
            hint={REPEATS_HINT}
            value={form.repeatsText}
            problem={form.repeatsProblem}
            disabled={form.pending}
            onChange={form.setRepeatsText}
          />

          <CeilingField
            amount={form.amount}
            currency={form.currency}
            onAmount={form.setAmount}
            onCurrency={form.setCurrency}
            placeholder="5.00"
            disabled={form.pending}
            problem={form.ceilingProblem}
            note={STRONGER_CEILING_NOTE}
          />

          {form.refused && (
            <p role="alert" className="text-destructive text-xs">
              {form.refused}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {CANCEL}
            </DialogClose>
            <Button type="submit" size="sm" disabled={form.pending}>
              {form.pending ? STARTING : START_STRONGER}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
