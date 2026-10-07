import { type FormEvent, useState } from 'react';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useStartSanityReplay } from '@/hooks/api/useStartSanityReplay';
import { useFollowStarted } from '@/hooks/useFollowStarted';
import { andReset } from '@/lib/and-reset';
import {
  ceilingFrom,
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
  firstStrongerPicks,
  offerOf,
  problemOnceTried,
  type StrongerSeed,
  sanityAsked,
} from '@/lib/stronger-model';

const FIRST_REPEATS = '1';

type StrongerModelFormOptions = {
  at: ReplayedStation;
  set: ReplaySet;
  live: StationLive & { readonly harness: string };
  seed: StrongerSeed;
  onOpenChange: (open: boolean) => void;
};

export function useStrongerModelForm({
  at,
  set,
  live,
  seed,
  onOpenChange,
}: StrongerModelFormOptions) {
  const first = firstStrongerPicks(seed, live);
  const start = useStartSanityReplay();
  const followStarted = useFollowStarted(onOpenChange);
  const harnesses = useHarnesses();
  const [model, setModel] = useState(first.model);
  const [effort, setEffort] = useState(first.effort);
  const [repeatsText, setRepeatsText] = useState(FIRST_REPEATS);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(USUAL_CURRENCY);
  const [tried, setTried] = useState(false);

  const offer = offerOf(harnesses.data, live.harness);
  const offerRead = harnesses.data !== undefined;
  const stronger = strongerAsked(live, model, effort);
  const problem = offerRead
    ? strongerProblem(live, model, effort, offer)
    : null;
  const ceiling = ceilingFrom(amount, currency);
  const repeats = repeatsFrom(repeatsText);

  const forget = () => {
    setModel(first.model);
    setEffort(first.effort);
    setRepeatsText(FIRST_REPEATS);
    setAmount('');
    setCurrency(USUAL_CURRENCY);
    setTried(false);
    start.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);

    const asked = sanityAsked(stronger, problem, ceiling, repeats);

    if (!asked || start.isPending) {
      return;
    }

    start.mutate(
      { teamId: at.teamId, setId: set.id, ...asked },
      { onSuccess: (started) => followStarted(replayPath(at, started.id)) },
    );
  };

  return {
    harnesses,
    offer,
    offerRead,
    model,
    effort,
    repeatsText,
    amount,
    currency,
    pending: start.isPending,
    chooseModel: andReset(setModel, start.reset),
    chooseEffort: andReset(setEffort, start.reset),
    setRepeatsText,
    setAmount,
    setCurrency,
    modelProblem: tried || stronger ? problem : null,
    repeatsProblem: problemOnceTried(tried, repeats),
    ceilingProblem: problemOnceTried(tried, ceiling),
    forget,
    submit,
  };
}
