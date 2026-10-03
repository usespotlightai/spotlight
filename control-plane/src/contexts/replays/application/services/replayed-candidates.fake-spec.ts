import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  AT,
  aSearch,
  aSet,
  BY,
  candidateOf,
  DIGESTS,
  FINGERPRINT,
  LIVE_FINGERPRINT,
  later,
  NOW,
  replayedAs,
  replayFor,
  SEARCH_ID,
  STATION,
  searchRunIds,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const RUN_ONE = RunId.of('search_run_1');

const PROMPT_CHANGED = StationChanges.of(LIVE_FINGERPRINT, [
  { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
]);

export const made = {
  station: STATION,
  address: AT,
  block: StationBlock.of({ key: 'build', name: 'Build', prompt: 'Go.' }),
  fingerprint: FINGERPRINT,
  digests: DIGESTS,
  scoring: UNSCORED,
  at: NOW,
};

const searchedCandidate = (name: string): Candidate =>
  Candidate.searched({
    ...made,
    id: CandidateId.of(`candidate_${name}`),
    name,
    changedFrom: PROMPT_CHANGED,
    search: {
      searchId: SEARCH_ID,
      iteration: 1,
      hypothesis: Hypothesis.of(`Being ${name} keeps it on task.`),
    },
  });

export const replayOf = (
  set: ReplaySet,
  id: string,
  candidate: Candidate,
  at: Date,
): Replay => {
  const started = Replay.started({
    id: ReplayId.of(id),
    set,
    candidate,
    baseline: false,
    ceiling: Spend.ceiling(100, 'USD'),
    at,
    by: BY,
  });

  started.pullEvents();

  return started;
};

export interface ReplayedWorld {
  readonly set: ReplaySet;
  readonly search: Search;
  readonly replays: readonly Replay[];
  readonly candidates: readonly Candidate[];
}

export const heldOutOf = (
  search: Search,
  replays: readonly Replay[],
  ids: () => RunId,
): Search => {
  let held = search
    .runEnded(RUN_ONE, { failed: false, started: true }, later(1), ids)
    .spentByAgent(RUN_ONE, ModelSpent.of([], 0), later(1), ids);

  for (const replayId of ['replay_terse', 'replay_wordy']) {
    held = held.replayEnded(
      ReplayId.of(replayId),
      'finished',
      { spent: Spend.of(1, 'USD'), unpriced: 0 },
      later(2),
      ids,
    );
  }
  while (held.heldRun) {
    const run = held.heldRun;

    held = held
      .runEnded(run, { failed: false, started: true }, later(3), ids)
      .spentByAgent(run, ModelSpent.of([], 0), later(3), ids);
  }

  return held.heldOutFrom(
    replays,
    0.05,
    () => ReplayId.of('replay_held_terse'),
    later(4),
  );
};

export const replayedWorld = (holdingOut = false): ReplayedWorld => {
  const set = aSet(10);
  const ids = searchRunIds();
  const searching = aSearch({ set })
    .replayEnded(
      ReplayId.of('replay_seed'),
      'finished',
      { spent: Spend.of(20, 'USD'), unpriced: 0 },
      NOW,
      ids,
    )
    .admitted(RUN_ONE, {
      candidateId: CandidateId.of('candidate_terse'),
      name: CandidateName.searched('terse'),
      replayId: ReplayId.of('replay_terse'),
    })
    .admitted(RUN_ONE, {
      candidateId: CandidateId.of('candidate_wordy'),
      name: CandidateName.searched('wordy'),
      replayId: ReplayId.of('replay_wordy'),
    });
  const missed = searching.split.searchedRuns[0]?.value;
  const proposed = candidateOf('proposed');
  const searched = [
    replayedAs(
      replayFor(set, 'replay_seed', 'candidate_live', null, true),
      () => 'completed',
      2,
    ),
    replayedAs(
      replayFor(
        set,
        'replay_terse',
        'candidate_terse',
        searching.split.searchedRuns,
      ),
      (original) => (original === missed ? 'failed' : 'completed'),
    ),
    replayFor(
      set,
      'replay_wordy',
      'candidate_wordy',
      searching.split.searchedRuns,
    ),
  ];
  const search = holdingOut ? heldOutOf(searching, searched, ids) : searching;

  return {
    set,
    search,
    replays: [
      ...searched,
      ...(holdingOut
        ? [
            replayedAs(
              replayFor(
                set,
                'replay_held_terse',
                'candidate_terse',
                search.split.heldOutRuns,
              ),
              () => 'completed',
            ),
          ]
        : []),
      replayedAs(
        replayOf(set, 'replay_proposed', proposed, new Date(NOW.getTime() + 1)),
        (original) =>
          original === 'original_1' || original === 'original_2'
            ? 'failed'
            : 'completed',
        3,
      ),
    ],
    candidates: [
      candidateOf('live'),
      searchedCandidate('terse'),
      searchedCandidate('wordy'),
      proposed,
    ],
  };
};
