import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { CountField } from '@/components/features/searches/station/CountField';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
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
import { useStartSanityReplay } from '@/hooks/api/useStartSanityReplay';
import { messageOf } from '@/lib/error';
import { CANCEL } from '@/lib/form-words';
import { failed } from '@/lib/query';
import {
  ceilingFrom,
  higherEffortsThan,
  type ReplayedStation,
  type ReplaySet,
  repeatsFrom,
  replayPath,
  type StationLive,
  strongerAsked,
  strongerProblem,
  USUAL_CURRENCY,
} from '@/lib/replay';
import {
  HARNESS_MODELS_UNREAD,
  MODEL_AND_EFFORT_LABEL,
  REPEATS_HINT,
  REPEATS_LABEL,
  START_STRONGER,
  STARTING,
  STRONGER_CEILING_NOTE,
  STRONGER_MODEL_NOTE,
  strongerHintShown,
  strongerTitleShown,
} from '@/lib/replay-words';
import { useForwardTrail } from '@/lib/trail';

const FIRST_REPEATS = '1';

type StrongerModelDialogProps = {
  at: ReplayedStation;
  set: ReplaySet;
  live: StationLive & { readonly harness: string };
  seed: {
    readonly model: string | null;
    readonly effort: string | null;
  } | null;
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
  const firstModel = seed?.model ?? live.model ?? '';
  const firstEffort = seed?.effort ?? live.effort ?? '';
  const start = useStartSanityReplay();
  const navigate = useNavigate();
  const trail = useForwardTrail();
  const [model, setModel] = useState(firstModel);
  const [effort, setEffort] = useState(firstEffort);
  const [repeatsText, setRepeatsText] = useState(FIRST_REPEATS);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(USUAL_CURRENCY);
  const [tried, setTried] = useState(false);

  const harnesses = useHarnesses();
  const offered = harnesses.data?.find((each) => each.id === live.harness);
  const offer = {
    models: offered?.models.map((each) => each.id) ?? [],
    efforts: offered?.efforts ?? [],
  };
  const offerRead = harnesses.data !== undefined;
  const stronger = strongerAsked(live, model, effort);
  const problem = offerRead
    ? strongerProblem(live, model, effort, offer)
    : null;
  const ceiling = ceilingFrom(amount, currency);
  const repeats = repeatsFrom(repeatsText);

  const forget = () => {
    setModel(firstModel);
    setEffort(firstEffort);
    setRepeatsText(FIRST_REPEATS);
    setAmount('');
    setCurrency(USUAL_CURRENCY);
    setTried(false);
    start.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);

    if (
      !stronger ||
      problem !== null ||
      typeof ceiling === 'string' ||
      typeof repeats === 'string' ||
      start.isPending
    ) {
      return;
    }

    start.mutate(
      { teamId: at.teamId, setId: set.id, stronger, ceiling, repeats },
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

  const refused = start.isError ? messageOf(start.error) : null;
  const shownProblem = tried || stronger ? problem : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && forget()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{strongerTitleShown(set.name)}</DialogTitle>
          <DialogDescription>{STRONGER_MODEL_NOTE}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-foreground text-xs">
              {MODEL_AND_EFFORT_LABEL}
            </span>
            <div className="-ml-2 flex">
              <ModelEffortSelect
                harness={live.harness}
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
            {offerRead && (
              <p className="text-muted-foreground text-xs leading-5">
                {strongerHintShown(
                  live.effort,
                  offer.efforts[0] ?? null,
                  higherEffortsThan(live.effort, offer),
                )}
              </p>
            )}
            {failed(harnesses) && (
              <CouldNotLoad
                what={HARNESS_MODELS_UNREAD}
                retrying={harnesses.isFetching}
                onRetry={() => void harnesses.refetch()}
                className="items-start"
              />
            )}
            {shownProblem && (
              <p role="alert" className="text-destructive text-xs">
                {shownProblem}
              </p>
            )}
          </div>

          <CountField
            label={REPEATS_LABEL}
            hint={REPEATS_HINT}
            value={repeatsText}
            problem={tried && typeof repeats === 'string' ? repeats : null}
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
            problem={tried && typeof ceiling === 'string' ? ceiling : null}
            note={STRONGER_CEILING_NOTE}
          />

          {refused && (
            <p role="alert" className="text-destructive text-xs">
              {refused}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {CANCEL}
            </DialogClose>
            <Button type="submit" size="sm" disabled={start.isPending}>
              {start.isPending ? STARTING : START_STRONGER}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
