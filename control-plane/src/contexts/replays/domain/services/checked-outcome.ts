import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayOutcome } from '@replays/domain/value-objects/replay-outcome.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReusedOutcome {
  readonly outcome: ReplayOutcome;
  readonly runs: readonly RunId[];
}

const among = (runs: readonly RunId[]) => (run: RunId) =>
  runs.some((each) => each.equals(run));

export const checkedOutcomeOf = (
  own: ReplayOutcome | null,
  reused: readonly ReusedOutcome[],
): ReplayOutcome | null => {
  const [first] = reused;
  const base = own ?? first?.outcome;

  if (!base || reused.length === 0) {
    return own;
  }

  const carried = reused.flatMap(({ outcome, runs }) =>
    outcome.entries
      .filter((each) => among(runs)(each.original))
      .map((each) => ({ ...each, spent: ModelSpent.none() })),
  );
  const entries = [...(own?.entries ?? []), ...carried].map((each, index) => ({
    ...each,
    position: index,
  }));
  const originals = [
    ...(own?.originals ?? []),
    ...reused.flatMap((each) => each.runs),
  ];

  return ReplayOutcome.of({
    id: base.id,
    setId: base.setId,
    candidateId: base.candidateId,
    searchId: own ? own.searchId : null,
    current: own?.current ?? 'finished',
    startedAt: base.startedAt,
    endedAt: own ? own.endedAt : (first?.outcome.endedAt ?? null),
    repeats: base.repeats,
    calibration: false,
    servesAsBaseline: false,
    healthSampleGroup: null,
    sampledAt: base.sampledAt,
    rubricVersion: base.rubricVersion,
    currency: base.currency,
    runSubset: null,
    referenceReplayId: null,
    pairwiseReferenceId: base.pairwiseReferenceId,
    originals,
    entries,
  });
};
