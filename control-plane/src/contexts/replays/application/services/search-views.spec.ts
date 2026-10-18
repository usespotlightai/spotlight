import { heldOutOf } from '@replays/application/services/replayed-candidates.fake-spec';
import {
  searchDetailView,
  searchSummaryView,
} from '@replays/application/services/search-views';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  aSearch,
  aSet,
  NOW,
  replayedAs,
  replayFor,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { DEFAULT_MIN_GAIN } from '@replays/domain/services/gain-estimate';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const RUN_ONE = RunId.of('search_run_1');

const heldOutWorld = (
  tasks: number,
): { search: Search; replays: readonly Replay[] } => {
  const set = aSet(tasks);
  const ids = searchRunIds();
  const searching = aSearch({ set })
    .recordReplayStopReason(
      ReplayId.of('replay_seed'),
      'finished',
      { spent: Money.of(10, 'USD'), unpriced: 0 },
      NOW,
      ids,
      true,
    )
    .acceptProposal(RUN_ONE, {
      candidateId: CandidateId.of('candidate_terse'),
      name: CandidateName.searched('terse'),
      replayId: ReplayId.of('replay_terse'),
    })
    .acceptProposal(RUN_ONE, {
      candidateId: CandidateId.of('candidate_wordy'),
      name: CandidateName.searched('wordy'),
      replayId: ReplayId.of('replay_wordy'),
    });
  const searched = [
    replayedAs(
      replayFor(set, 'replay_seed', 'candidate_live', null, true),
      () => 'failed',
    ),
    replayedAs(
      replayFor(
        set,
        'replay_terse',
        'candidate_terse',
        searching.split.searchedRuns,
      ),
      () => 'completed',
    ),
    replayedAs(
      replayFor(
        set,
        'replay_wordy',
        'candidate_wordy',
        searching.split.searchedRuns,
      ),
      () => 'failed',
    ),
  ];
  const search = heldOutOf(searching, searched, ids);
  const [onlyHeldOutWin] = search.split.heldOutRuns;

  return {
    search,
    replays: [
      ...searched,
      replayedAs(
        replayFor(
          set,
          'replay_held_out_terse',
          'candidate_terse',
          search.split.heldOutRuns,
        ),
        (original) =>
          original === onlyHeldOutWin?.value ? 'completed' : 'failed',
      ),
    ],
  };
};

describe('search views', () => {
  it('marks the best candidate and the candidate itself when the gain showed only on the searched tasks', () => {
    const { search, replays } = heldOutWorld(20);

    const summary = searchSummaryView(search, replays, DEFAULT_MIN_GAIN);
    const detail = searchDetailView(search, replays, [], [], DEFAULT_MIN_GAIN);

    expect(summary.best).toMatchObject({
      name: 'terse',
      overfit: 'likely',
    });
    expect(
      detail.candidates.find((each) => each.name === 'terse')?.overfit,
    ).toBe('likely');
    expect(detail.seed.overfit).toBeNull();
    expect(detail.overfitCount).toBe(1);
  });

  it('says too few held-out tasks were scored to tell, and does not count it as overfit', () => {
    const { search, replays } = heldOutWorld(10);

    const detail = searchDetailView(search, replays, [], [], DEFAULT_MIN_GAIN);

    expect(detail.best).toMatchObject({
      name: 'terse',
      overfit: 'too-few-held-out',
    });
    expect(
      detail.candidates.find((each) => each.name === 'terse')?.overfit,
    ).toBe('too-few-held-out');
    expect(detail.overfitCount).toBe(0);
  });
});
