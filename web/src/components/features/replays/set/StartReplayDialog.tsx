import { type FormEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { CandidateChoices } from '@/components/features/replays/set/CandidateChoices';
import { CountField } from '@/components/features/searches/station/CountField';
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
  type Replay,
  type ReplayedStation,
  type ReplaySet,
  repeatsFrom,
  replayPath,
  USUAL_CURRENCY,
} from '@/lib/replay';
import { baselineNoteShown, REPEATS_HINT } from '@/lib/replay-words';
import { useForwardTrail } from '@/lib/trail';

const LABEL = 'font-medium text-foreground text-xs';

type StartReplayDialogProps = {
  at: ReplayedStation;
  set: ReplaySet;
  baseline: Pick<Replay, 'repeats'> | null;
  firstRepeats?: number;
  firstCandidate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StartReplayDialog({
  at,
  set,
  baseline,
  firstRepeats = 1,
  firstCandidate = LIVE,
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
  const [candidate, setCandidate] = useState(firstCandidate);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(USUAL_CURRENCY);
  const [repeatsText, setRepeatsText] = useState(String(firstRepeats));
  const [tried, setTried] = useState(false);

  const ceiling = ceilingFrom(amount, currency);
  const repeats = repeatsFrom(repeatsText);
  const problem = typeof ceiling === 'string' ? ceiling : null;
  const repeatsProblem = typeof repeats === 'string' ? repeats : null;

  const forget = () => {
    setCandidate(firstCandidate);
    setAmount('');
    setCurrency(USUAL_CURRENCY);
    setRepeatsText(String(firstRepeats));
    setTried(false);
    start.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);

    if (
      typeof ceiling === 'string' ||
      typeof repeats === 'string' ||
      start.isPending
    ) {
      return;
    }

    start.mutate(
      { teamId: at.teamId, setId: set.id, candidate, ceiling, repeats },
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

          <CountField
            label="Repeats"
            hint={REPEATS_HINT}
            value={repeatsText}
            problem={tried ? repeatsProblem : null}
            disabled={start.isPending}
            onChange={setRepeatsText}
          />

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
              starts.{' '}
              {baselineNoteShown(
                candidate !== LIVE,
                baseline?.repeats ?? null,
                typeof repeats === 'number' ? repeats : null,
              )}
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
