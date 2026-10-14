import {
  CLOCK,
  FakeOutcomes,
  FakeWork,
  IDS,
  InMemoryReplays,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { StartOracleReplay } from '@replays/application/services/start-oracle-replay.service';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import {
  aReplay,
  aSet,
  BY,
  candidateOf,
  concludedAll,
  LIVE_FINGERPRINT,
} from '@replays/domain/replays.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;
let turnouts: FakeOutcomes;

const LIVE = candidateOf('live');

const oracles = () =>
  new StartOracleReplay(
    memory.setRepository,
    memory.replayRepository,
    memory.candidateRepository,
    work,
    turnouts,
    IDS,
    CLOCK,
    TRANSACTION,
  );

const finishedLive = async (
  input: { among?: readonly RunId[]; repeats?: number } = {},
) => {
  const replay = concludedAll(
    aReplay({
      id: 'replay_live',
      count: 4,
      candidate: LIVE,
      ceiling: 10,
      ...input,
    }),
  );

  replay.pullEvents();
  await memory.replayRepository.add(replay);

  return new ReplayEnded(replay.id, replay.workspaceId, null, 'finished');
};

const oracleReplays = () =>
  [...memory.replays.values()].filter(
    (each) => memory.candidates.get(each.candidateId.value)?.isOracle,
  );

beforeEach(async () => {
  memory = new InMemoryReplays();
  work = new FakeWork();
  turnouts = new FakeOutcomes();
  await memory.setRepository.add(aSet(4));
  await memory.candidateRepository.add(LIVE);
});

describe('StartOracleReplay', () => {
  it('replays the live config handed the answer on the runs that have one, once a whole-set live replay finishes', async () => {
    turnouts.accepted.add('original_0');
    turnouts.sentBack.add('original_2');

    await oracles().baselineEnded(await finishedLive({ repeats: 2 }));

    const [oracle] = oracleReplays();
    const candidate = memory.candidates.get(oracle?.candidateId.value ?? '');

    expect(oracleReplays()).toHaveLength(1);
    expect(candidate?.block).toEqual(LIVE.block);
    expect(candidate?.name.value).toMatch(/^With the answer, /);
    expect(oracle?.among?.map((each) => each.value)).toEqual([
      'original_0',
      'original_2',
    ]);
    expect(oracle?.comparedWith?.value).toBe('replay_live');
    expect(oracle?.answerTo(RunId.of('original_0'))).toBe('accepted');
    expect(oracle?.answerTo(RunId.of('original_2'))).toBe('sent-back');
    expect(oracle?.pairsWith).toBeNull();
    expect(oracle?.repeats).toBe(2);
    expect(oracle?.ceiling.amount).toBe(10);
  });

  it('starts nothing when the live config moves on while it is starting', async () => {
    turnouts.accepted.add('original_0');
    const live = work.live;
    let asked = 0;
    work.live = async () => {
      asked += 1;
      return asked === 1
        ? live()
        : { ...(await live()), fingerprint: LIVE_FINGERPRINT };
    };

    await oracles().baselineEnded(await finishedLive());

    expect(asked).toBe(2);
    expect(oracleReplays()).toEqual([]);
  });

  it('leaves out runs Work has no answer for, and runs the live replay did not replay', async () => {
    turnouts.accepted.add('original_0');
    turnouts.accepted.add('original_1');
    turnouts.sentBack.add('original_2');
    work.unanswerable.add('original_1');

    await oracles().baselineEnded(
      await finishedLive({
        among: [RunId.of('original_0'), RunId.of('original_1')],
      }),
    );

    expect(oracleReplays()).toEqual([]);

    memory.replays.clear();
    await oracles().baselineEnded(await finishedLive());

    expect(oracleReplays()[0]?.among?.map((each) => each.value)).toEqual([
      'original_0',
      'original_2',
    ]);
  });

  it('starts one for each live config, however often its live replays finish', async () => {
    turnouts.accepted.add('original_0');
    const ended = await finishedLive();

    await oracles().baselineEnded(ended);
    await oracles().baselineEnded(ended);

    expect(oracleReplays()).toHaveLength(1);
  });

  it('tries again after the next live replay when the last one did not finish', async () => {
    turnouts.accepted.add('original_0');
    const ended = await finishedLive();

    await oracles().baselineEnded(ended);
    const [first] = oracleReplays();
    await memory.replayRepository.save(
      (first as NonNullable<typeof first>).stopped(new Date(), BY),
    );
    await oracles().baselineEnded(ended);

    expect(oracleReplays()).toHaveLength(2);
  });

  it('starts none for a replay of part of the set, one that did not finish, a config no longer live, or a set with no answers', async () => {
    turnouts.accepted.add('original_0');
    const partial = await finishedLive({ among: [RunId.of('original_0')] });

    await oracles().baselineEnded(partial);
    await oracles().baselineEnded(
      new ReplayEnded(partial.replayId, partial.workspaceId, null, 'stopped'),
    );

    memory.replays.clear();
    const whole = await finishedLive();
    const live = work.live;
    work.live = async () => ({
      ...(await live()),
      fingerprint: LIVE_FINGERPRINT,
    });
    await oracles().baselineEnded(whole);

    work.live = live;
    turnouts.accepted.clear();
    await oracles().baselineEnded(whole);

    expect(oracleReplays()).toEqual([]);
  });
});
