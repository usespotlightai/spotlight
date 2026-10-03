import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  aSearch,
  aSet,
  NOW,
  replayedAs,
  replayFor,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { failingSearchedTasksOf } from '@replays/domain/services/reflected-tasks';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const SET = aSet(10);

const seeded = (): Search =>
  aSearch({ set: SET }).replayEnded(
    ReplayId.of('replay_seed'),
    'finished',
    { spent: Spend.of(10, 'USD'), unpriced: 0 },
    NOW,
    searchRunIds(),
    true,
  );

const withTerse = (): Search =>
  seeded().admitted(RunId.of('search_run_1'), {
    candidateId: CandidateId.of('candidate_terse'),
    name: CandidateName.searched('terse'),
    replayId: ReplayId.of('replay_terse'),
  });

const seedFailing = (failing: ReadonlySet<string>) =>
  replayedAs(
    replayFor(SET, 'replay_seed', 'candidate_live', null, true),
    (original) => (failing.has(original) ? 'failed' : 'completed'),
  );

describe('failingSearchedTasksOf', () => {
  it('takes the searched tasks the seed failed while no candidate finished, never a held-out one', () => {
    const search = withTerse();
    const searched = search.split.searched.map((each) => each.runId.value);
    const heldOut = search.split.heldOut.map((each) => each.runId.value);
    const seed = seedFailing(new Set([searched[0], heldOut[0]] as string[]));

    const { candidateId, tasks } = failingSearchedTasksOf(search, [seed], 0.05);

    expect(candidateId).toEqual(search.seed.candidateId);
    expect(tasks.map((each) => each.originalRunId.value)).toEqual([
      searched[0],
    ]);
    expect(tasks[0]?.taskId).toEqual(search.split.searched[0]?.taskId);
    expect(tasks[0]?.replayRunId).toEqual(
      seed.entries.find((each) => each.original.value === searched[0])?.run,
    );
  });

  it('takes the failures of the best candidate so far, not the seed’s', () => {
    const search = withTerse();
    const searched = search.split.searched.map((each) => each.runId.value);
    const seed = seedFailing(new Set(searched.slice(0, 3)));
    const terse = replayedAs(
      replayFor(
        SET,
        'replay_terse',
        'candidate_terse',
        search.split.searchedRuns,
      ),
      (original) => (original === searched[4] ? 'failed' : 'completed'),
    );

    const failing = failingSearchedTasksOf(search, [seed, terse], 0.05);

    expect(failing.candidateId.value).toBe('candidate_terse');
    expect(failing.tasks.map((each) => each.originalRunId.value)).toEqual([
      searched[4],
    ]);
  });

  it('takes a task that mostly fails, with a success mean below one half over its copies, once, linking its first failing copy', () => {
    const search = seeded();
    const first = search.split.searched[0]?.runId.value;
    const seed = replayedAs(
      replayFor(SET, 'replay_seed', 'candidate_live', null, true, 3),
      (original, repeat) =>
        original === first && repeat > 0 ? 'failed' : 'completed',
    );

    const { tasks } = failingSearchedTasksOf(search, [seed], 0.05);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.replayRunId).toEqual(
      seed.entries.find(
        (each) => each.original.value === first && each.repeat === 1,
      )?.run,
    );
  });

  it('leaves out a task whose copies mostly succeed, though one of them failed', () => {
    const search = seeded();
    const first = search.split.searched[0]?.runId.value;
    const seed = replayedAs(
      replayFor(SET, 'replay_seed', 'candidate_live', null, true, 3),
      (original, repeat) =>
        original === first && repeat === 0 ? 'failed' : 'completed',
    );

    expect(failingSearchedTasksOf(search, [seed], 0.05).tasks).toEqual([]);
  });

  it('leaves out a task that fails exactly half of its copies, as it does not mostly fail', () => {
    const search = seeded();
    const first = search.split.searched[0]?.runId.value;
    const seed = replayedAs(
      replayFor(SET, 'replay_seed', 'candidate_live', null, true, 2),
      (original, repeat) =>
        original === first && repeat === 1 ? 'failed' : 'completed',
    );

    expect(failingSearchedTasksOf(search, [seed], 0.05).tasks).toEqual([]);
  });

  it('finds nothing when every searched task succeeded', () => {
    const search = seeded();

    expect(
      failingSearchedTasksOf(search, [seedFailing(new Set())], 0.05).tasks,
    ).toEqual([]);
  });
});
