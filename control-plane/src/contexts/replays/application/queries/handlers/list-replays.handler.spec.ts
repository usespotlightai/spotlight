import type { ReplayDto } from '@replays/application/dto/replays.dto';
import { ListReplaysHandler } from '@replays/application/queries/handlers/list-replays.handler';
import { ListReplaysQuery } from '@replays/application/queries/list-replays.query';
import {
  accessFor,
  FakeWork,
  InMemoryReplays,
  PERSON,
} from '@replays/application/services/replays.fake-spec';
import { SetHealths } from '@replays/application/services/set-healths.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  aReplay,
  aSet,
  BY,
  candidateOf,
  later,
  NOW,
  replayedAs,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { describe, expect, it } from 'vitest';

const live = candidateOf('live');

const aBaseline = (id: string, at: number, outcome: 'completed' | 'failed') =>
  replayedAs(
    aReplay({ id, candidate: live, baseline: true, at: later(at) }),
    () => outcome,
  );

const withTheAnswer = (against: Replay): Replay => {
  const set = aSet(3);
  const replay = Replay.started({
    id: ReplayId.of('replay_answer'),
    set,
    candidate: Candidate.oracleOf(live, {
      id: CandidateId.of('candidate_answer'),
      at: NOW,
    }),
    baseline: false,
    ceiling: Spend.ceiling(10, 'USD'),
    at: later(3),
    by: BY,
    oracle: {
      answers: set.runs.map((run) => ({ run, answer: 'accepted' as const })),
      against,
      live,
    },
  });

  replay.pullEvents();

  return replay;
};

const listed = async (
  replays: readonly Replay[],
): Promise<readonly ReplayDto[]> => {
  const memory = new InMemoryReplays();
  const work = new FakeWork();

  await memory.setRepository.add(aSet(3));
  for (const each of replays) {
    await memory.replayRepository.add(each);
  }
  for (const each of [live, candidateOf('proposed')]) {
    await memory.candidateRepository.add(each);
  }

  return new ListReplaysHandler(
    accessFor(memory, work),
    memory.replayRepository,
    memory.candidateRepository,
    new SetHealths(work, memory.replayRepository, memory.candidateRepository),
  ).execute(new ListReplaysQuery(STATION.teamId.value, 'set_1', PERSON));
};

const comparedWithOf = (replays: readonly ReplayDto[], id: string) =>
  replays.find((each) => each.id === id)?.comparedWith;

describe('ListReplaysHandler', () => {
  it('names the replay each gain is against, with that replay’s success rate', async () => {
    const old = aBaseline('replay_old', 0, 'completed');
    const fresh = aBaseline('replay_fresh', 1, 'failed');
    const paired = aReplay({
      id: 'replay_paired',
      pairsWith: 'replay_old',
      at: later(2),
    });
    const answer = withTheAnswer(old);
    const proposed = aReplay({ id: 'replay_proposed', at: later(4) });

    const replays = await listed([old, fresh, paired, answer, proposed]);
    const oldRate = { replayId: 'replay_old', successRate: 1 };
    const freshRate = { replayId: 'replay_fresh', successRate: 0 };

    expect(comparedWithOf(replays, 'replay_paired')).toMatchObject(oldRate);
    expect(comparedWithOf(replays, 'replay_answer')).toMatchObject(oldRate);
    expect(comparedWithOf(replays, 'replay_proposed')).toMatchObject(freshRate);
    expect(comparedWithOf(replays, 'replay_old')).toMatchObject(freshRate);
    expect(comparedWithOf(replays, 'replay_fresh')).toBeNull();
  });

  it('carries the interval of the replay compared with', async () => {
    const fresh = aBaseline('replay_fresh', 1, 'completed');
    const proposed = aReplay({ id: 'replay_proposed', at: later(4) });

    const replays = await listed([fresh, proposed]);

    expect(comparedWithOf(replays, 'replay_proposed')).toEqual({
      replayId: 'replay_fresh',
      successRate: 1,
      interval: replays.find((each) => each.id === 'replay_fresh')?.totals
        .interval,
    });
    expect(comparedWithOf(replays, 'replay_proposed')?.interval).not.toBeNull();
  });
});
