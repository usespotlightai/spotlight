import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
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
import { useProbeReplaySet } from '@/hooks/api/useProbeReplaySet';
import { CANCEL } from '@/lib/form-words';
import {
  ceilingFrom,
  type ReplayedStation,
  type ReplaySet,
  replayPath,
  USUAL_CURRENCY,
} from '@/lib/replay';
import {
  PROBE_CEILING_NOTE,
  PROBE_NOTE,
  probeTitleShown,
  START_PROBE,
  STARTING,
} from '@/lib/replay-words';
import { useForwardTrail } from '@/lib/trail';

type ProbeSetDialogProps = {
  at: ReplayedStation;
  set: ReplaySet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProbeSetDialog({
  at,
  set,
  open,
  onOpenChange,
}: ProbeSetDialogProps) {
  const probe = useProbeReplaySet();
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(USUAL_CURRENCY);
  const [tried, setTried] = useState(false);

  const ceiling = ceilingFrom(amount, currency);

  const forget = () => {
    setAmount('');
    setCurrency(USUAL_CURRENCY);
    setTried(false);
    probe.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);

    if (typeof ceiling === 'string' || probe.isPending) {
      return;
    }

    probe.mutate(
      { teamId: at.teamId, setId: set.id, ceiling },
      {
        onSuccess: (started) => {
          onOpenChange(false);
          navigate(replayPath(at, started.id), {
            state: trail.length > 0 ? { trail } : undefined,
          });
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && forget()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{probeTitleShown(set.name)}</DialogTitle>
          <DialogDescription>{PROBE_NOTE}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <CeilingField
            amount={amount}
            currency={currency}
            onAmount={setAmount}
            onCurrency={setCurrency}
            placeholder="10.00"
            disabled={probe.isPending}
            problem={tried && typeof ceiling === 'string' ? ceiling : null}
            note={PROBE_CEILING_NOTE}
          />

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {CANCEL}
            </DialogClose>
            <Button type="submit" size="sm" disabled={probe.isPending}>
              {probe.isPending ? STARTING : START_PROBE}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
