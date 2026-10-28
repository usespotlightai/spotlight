import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { CandidateChoices } from '@/components/features/replays/set/CandidateChoices';
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
import { useStartReplay } from '@/hooks/api/useStartReplay';
import { useStationCandidates } from '@/hooks/api/useStationCandidates';
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
import {
  checksSetOf,
  formatBaselineNote,
  REPEATS_HINT,
} from '@/lib/replay-words';
import { useForwardTrail } from '@/lib/trail';

const LABEL = 'font-medium text-foreground text-xs';

const FIRST_REPEATS = '1';

type StartReplayDialogProps = {
  at: ReplayedStation;
  set: ReplaySet;
  baseline: Pick<Replay, 'repeats'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StartReplayDialog({
  at,
  set,
  baseline,
  open,
  onOpenChange,
}: StartReplayDialogProps) {
  const { candidates } = useStationCandidates(at);
  const start = useStartReplay();
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const [candidate, setCandidate] = useState(LIVE);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(USUAL_CURRENCY);
  const [repeatsText, setRepeatsText] = useState(FIRST_REPEATS);
  const [tried, setTried] = useState(false);

  const ceiling = ceilingFrom(amount, currency);
  const repeats = repeatsFrom(repeatsText);
  const problem = typeof ceiling === 'string' ? ceiling : null;
  const repeatsProblem = typeof repeats === 'string' ? repeats : null;

  const reset = () => {
    setCandidate(LIVE);
    setAmount('');
    setCurrency(USUAL_CURRENCY);
    setRepeatsText(FIRST_REPEATS);
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

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(open) => !open && reset()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replay the set</DialogTitle>
          <DialogDescription>
            Each of the set’s {set.entries.length} runs restarts from its
            starting point under the chosen config. Nothing goes to the task,
            GitHub or any inbox.
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

          <CeilingField
            amount={amount}
            currency={currency}
            onAmount={setAmount}
            onCurrency={setCurrency}
            placeholder="5.00"
            disabled={start.isPending}
            problem={shownProblem}
            note={
              <>
                The most that this replay can spend. Its runs count, and so does
                the generation and judging of their change stacks. Nothing more
                starts after the replay spends it.{' '}
                {formatBaselineNote(
                  candidate !== LIVE,
                  baseline?.repeats ?? null,
                  typeof repeats === 'number' ? repeats : null,
                  checksSetOf(set),
                )}
              </>
            }
          />

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
