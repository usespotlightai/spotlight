import { type FormEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { CandidateChoices } from '@/components/features/replays/set/CandidateChoices';
import { FieldInput } from '@/components/shared/form/FieldInput';
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
import { useStartReplay } from '@/hooks/api/useStartReplay';
import { useStationCandidates } from '@/hooks/api/useStationCandidates';
import { messageOf } from '@/lib/error';
import {
  ceilingFrom,
  LIVE,
  type ReplayedStation,
  type ReplaySet,
  replayPath,
  USUAL_CURRENCY,
} from '@/lib/replay';
import { useForwardTrail } from '@/lib/trail';

const LABEL = 'font-medium text-foreground text-xs';

type StartReplayDialogProps = {
  at: ReplayedStation;
  set: ReplaySet;
  hasBaseline: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const baselineNote = (proposed: boolean, hasBaseline: boolean): string => {
  if (!proposed) {
    return hasBaseline
      ? 'If the set’s runs changed since its baseline, this replay of the live config becomes the new baseline; otherwise it replays beside it.'
      : 'The set has no baseline yet, so this replay of the live config becomes it.';
  }

  return hasBaseline
    ? 'If the set’s runs changed since its baseline, a new baseline of the live config also starts, with a ceiling of its own the same as this one.'
    : 'The set has no baseline yet, so a baseline of the live config also starts beside it, with a ceiling of its own the same as this one: the two together may spend up to twice it.';
};

export function StartReplayDialog({
  at,
  set,
  hasBaseline,
  open,
  onOpenChange,
}: StartReplayDialogProps) {
  const { candidates } = useStationCandidates(at);
  const start = useStartReplay();
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const amountId = useId();
  const currencyId = useId();
  const errorId = useId();
  const [candidate, setCandidate] = useState(LIVE);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(USUAL_CURRENCY);
  const [tried, setTried] = useState(false);

  const ceiling = ceilingFrom(amount, currency);
  const problem = typeof ceiling === 'string' ? ceiling : null;

  const forget = () => {
    setCandidate(LIVE);
    setAmount('');
    setCurrency(USUAL_CURRENCY);
    setTried(false);
    start.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);

    if (typeof ceiling === 'string' || start.isPending) {
      return;
    }

    start.mutate(
      { teamId: at.teamId, setId: set.id, candidate, ceiling },
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

  const shownProblem = tried ? problem : null;
  const refused = start.isError ? messageOf(start.error) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && forget()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replay {set.name}</DialogTitle>
          <DialogDescription>
            Each of the set’s {set.entries.length} runs starts again from where
            it started, under the config you choose. Nothing it does reaches the
            task, GitHub or anyone’s inbox.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <fieldset className="flex flex-col gap-1.5">
            <legend className={`${LABEL} mb-1.5`}>Replay under</legend>
            <CandidateChoices
              candidates={candidates}
              value={candidate}
              onChange={setCandidate}
              disabled={start.isPending}
            />
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Ceiling</span>
            <div className="flex gap-2">
              <label htmlFor={amountId} className="sr-only">
                Most it may spend
              </label>
              <FieldInput
                id={amountId}
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="5.00"
                disabled={start.isPending}
                aria-invalid={shownProblem !== null}
                aria-describedby={shownProblem || refused ? errorId : undefined}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <label htmlFor={currencyId} className="sr-only">
                Currency
              </label>
              <FieldInput
                id={currencyId}
                name="currency"
                autoComplete="off"
                maxLength={3}
                className="w-20 uppercase"
                disabled={start.isPending}
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
              />
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              The most this replay may spend, counting its runs and the drafting
              and judging of their changes. Once it is spent, nothing more
              starts. {baselineNote(candidate !== LIVE, hasBaseline)}
            </p>
          </div>

          {(shownProblem || refused) && (
            <p id={errorId} role="alert" className="text-destructive text-xs">
              {shownProblem ?? refused}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="sm" disabled={start.isPending}>
              {start.isPending ? 'Starting…' : 'Start replay'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
