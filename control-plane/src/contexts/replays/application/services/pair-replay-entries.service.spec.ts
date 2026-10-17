import { AskForPairJudging } from '@replays/application/services/ask-for-pair-judging.service';
import { NoteReplayPaired } from '@replays/application/services/note-replay-paired.service';
import { PairReplayEntries } from '@replays/application/services/pair-replay-entries.service';
import {
  FakeOutcomes,
  InMemoryReplays,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import type { ReplayPairJudgingWanted } from '@replays/domain/events/replay-pair-judging-wanted.event';
import type { ReplayPairingDue } from '@replays/domain/events/replay-pairing-due.event';
import { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import {
  aReplay,
  BY,
  candidateOf,
  concludedAll,
  NOW,
  RUBRIC,
  runOf,
} from '@replays/domain/replays.fake-spec';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const proposed = candidateOf('proposed', 'candidate_proposed', RUBRIC);

const live = candidateOf('live', 'candidate_live', RUBRIC);

let memory: InMemoryReplays;
let outcomes: FakeOutcomes;

const stored = async (replay: Replay) => {
  await memory.replayRepository.add(replay);
};

const pairing = () =>
  new PairReplayEntries(memory.replayRepository, outcomes, TRANSACTION);

const concludedEvent = (replay: Replay) =>
  new ReplayEntryConcluded(
    replay.id,
    replay.workspaceId,
    replay.setId,
    runOf(replay.id.value, 0),
  );

beforeEach(async () => {
  memory = new InMemoryReplays();
  outcomes = new FakeOutcomes();
  outcomes.accepted.add('original_0');
  outcomes.accepted.add('original_1');
  await memory.candidateRepository.add(proposed);
  await stored(
    concludedAll(
      aReplay({ id: 'baseline_1', count: 2, baseline: true, candidate: live }),
    ),
  );
  await stored(
    concludedAll(
      aReplay({
        id: 'replay_1',
        count: 2,
        candidate: proposed,
        pairsWith: 'baseline_1',
      }),
    ),
  );
  memory.events.length = 0;
});

describe('PairReplayEntries', () => {
  it('finds, from a baseline’s concluded entry, each replay set beside it', async () => {
    const baseline = await memory.replayRepository.find(
      ReplayId.of('baseline_1'),
    );
    const due = (await pairing().concluded(
      concludedEvent(baseline as Replay),
    )) as ReplayPairingDue[];

    expect(due.map((each) => each.replayId.value)).toEqual(['replay_1']);
  });

  it('finds, from a replay’s own concluded entry, only that replay, and none once it was stopped', async () => {
    const replay = (await memory.replayRepository.find(
      ReplayId.of('replay_1'),
    )) as Replay;

    expect(
      (
        (await pairing().concluded(
          concludedEvent(replay),
        )) as ReplayPairingDue[]
      ).map((each) => each.replayId.value),
    ).toEqual(['replay_1']);

    memory.replays.set(
      'replay_2',
      aReplay({
        id: 'replay_2',
        count: 2,
        candidate: proposed,
        pairsWith: 'baseline_1',
      }).stop(NOW, BY),
    );
    const baseline = (await memory.replayRepository.find(
      ReplayId.of('baseline_1'),
    )) as Replay;

    expect(
      (
        (await pairing().concluded(
          concludedEvent(baseline),
        )) as ReplayPairingDue[]
      ).map((each) => each.replayId.value),
    ).toEqual(['replay_1']);
  });

  it('asks a side-by-side judging only for tasks people accepted a change for', async () => {
    outcomes.accepted.delete('original_1');

    await pairing().due(ReplayId.of('replay_1'));

    const wanted = memory.events.filter(
      (each): each is ReplayPairJudgingWanted =>
        each.kind === 'replay.pair-judging-wanted',
    );
    expect(wanted.map((each) => [each.run.value, each.against.value])).toEqual([
      ['replay_1_run_0', 'baseline_1_run_0'],
    ]);
  });

  it('asks nothing for a replay with no baseline to be set beside', async () => {
    memory.replays.delete('baseline_1');

    await pairing().due(ReplayId.of('replay_1'));

    expect(memory.events).toEqual([]);
  });
});

describe('AskForPairJudging and NoteReplayPaired', () => {
  const wanted = async () => {
    await pairing().due(ReplayId.of('replay_1'));

    return memory.events.find(
      (each): each is ReplayPairJudgingWanted =>
        each.kind === 'replay.pair-judging-wanted',
    ) as ReplayPairJudgingWanted;
  };

  it('asks the judge with the candidate’s criteria and the original as the reference', async () => {
    const event = await wanted();

    expect(
      await new AskForPairJudging(
        memory.replayRepository,
        memory.candidateRepository,
        outcomes,
      ).wanted(event),
    ).toEqual([]);
    expect(outcomes.pairsAsked).toEqual([
      expect.objectContaining({
        run: RunId.of('replay_1_run_0'),
        against: RunId.of('baseline_1_run_0'),
        reference: RunId.of('original_0'),
        judge: proposed.judge,
      }),
    ]);
  });

  it('says why it could not ask, and the replay keeps that as the entry’s answer', async () => {
    const event = await wanted();
    outcomes.pairAnswer = 'unavailable';

    const [failed] = (await new AskForPairJudging(
      memory.replayRepository,
      memory.candidateRepository,
      outcomes,
    ).wanted(event)) as ReplayPairingFailed[];
    await new NoteReplayPaired(memory.replayRepository, TRANSACTION).askFailed(
      failed as ReplayPairingFailed,
    );

    expect(failed?.why).toBe('unavailable');
    expect(
      (await memory.replayRepository.find(event.replayId))?.entries[0]?.pairing
        ?.unpaired,
    ).toBe('unavailable');
  });

  it('keeps the verdict heard back, with what it cost', async () => {
    const event = await wanted();

    await new NoteReplayPaired(memory.replayRepository, TRANSACTION).paired({
      runId: event.run.value,
      againstRunId: event.against.value,
      winner: 'against',
      model: 'judge/model',
      readings: [
        { runShownFirst: true, winner: 'against', reasons: [] },
        { runShownFirst: false, winner: 'against', reasons: [] },
      ],
      spent: ModelSpent.of([Spend.of(0.02, 'USD')], 0),
    });

    const entry = (await memory.replayRepository.find(event.replayId))
      ?.entries[0];
    expect(entry?.pairing?.verdict?.outcome).toBe('loss');
    expect(entry?.pairingSpent?.spends[0]?.amount).toBe(0.02);
  });
});
