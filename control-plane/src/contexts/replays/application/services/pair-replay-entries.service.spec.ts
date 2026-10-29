import { PairReplayEntries } from '@replays/application/services/pair-replay-entries.service';
import { RecordReplayPairVerdict } from '@replays/application/services/record-replay-pair-verdict.service';
import {
  FakeInsights,
  InMemoryReplays,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { RequestReplaySideBySideJudging } from '@replays/application/services/request-replay-side-by-side-judging.service';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import type { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import type { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
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
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const proposed = candidateOf('searched', 'candidate_proposed', RUBRIC);

const live = candidateOf('live', 'candidate_live', RUBRIC);

let memory: InMemoryReplays;
let insights: FakeInsights;

const stored = async (replay: Replay) => {
  await memory.replayRepository.add(replay);
};

const pairing = () =>
  new PairReplayEntries(memory.replayRepository, insights, TRANSACTION);

const concludedEvent = (replay: Replay) =>
  new ReplayEntryConcluded(
    replay.id,
    replay.workspaceId,
    replay.setId,
    runOf(replay.id.value, 0),
  );

beforeEach(async () => {
  memory = new InMemoryReplays();
  insights = new FakeInsights();
  insights.accepted.add('original_0');
  insights.accepted.add('original_1');
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
        pairwiseReferenceId: 'baseline_1',
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
    )) as ReplayPairingRequested[];

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
        )) as ReplayPairingRequested[]
      ).map((each) => each.replayId.value),
    ).toEqual(['replay_1']);

    memory.replays.set(
      'replay_2',
      aReplay({
        id: 'replay_2',
        count: 2,
        candidate: proposed,
        pairwiseReferenceId: 'baseline_1',
      }).stop(NOW, BY),
    );
    const baseline = (await memory.replayRepository.find(
      ReplayId.of('baseline_1'),
    )) as Replay;

    expect(
      (
        (await pairing().concluded(
          concludedEvent(baseline),
        )) as ReplayPairingRequested[]
      ).map((each) => each.replayId.value),
    ).toEqual(['replay_1']);
  });

  it('requests a side-by-side judging only for tasks people accepted a change for', async () => {
    insights.accepted.delete('original_1');

    await pairing().requested(ReplayId.of('replay_1'));

    const wanted = memory.events.filter(
      (each): each is ReplaySideBySideJudgingRequested =>
        each.kind === 'replay.side-by-side-judging-requested',
    );
    expect(wanted.map((each) => [each.run.value, each.other.value])).toEqual([
      ['replay_1_run_0', 'baseline_1_run_0'],
    ]);
  });

  it('requests nothing for a replay with no baseline to be set beside', async () => {
    memory.replays.delete('baseline_1');

    await pairing().requested(ReplayId.of('replay_1'));

    expect(memory.events).toEqual([]);
  });
});

describe('RequestReplaySideBySideJudging and RecordReplayPairVerdict', () => {
  const wanted = async () => {
    await pairing().requested(ReplayId.of('replay_1'));

    return memory.events.find(
      (each): each is ReplaySideBySideJudgingRequested =>
        each.kind === 'replay.side-by-side-judging-requested',
    ) as ReplaySideBySideJudgingRequested;
  };

  it('requests judging with the candidate’s criteria and the original as the reference', async () => {
    const event = await wanted();

    expect(
      await new RequestReplaySideBySideJudging(
        memory.replayRepository,
        memory.candidateRepository,
        insights,
      ).requested(event),
    ).toEqual([]);
    expect(insights.sideBySideJudgingRequests).toEqual([
      expect.objectContaining({
        run: RunId.of('replay_1_run_0'),
        other: RunId.of('baseline_1_run_0'),
        reference: RunId.of('original_0'),
        judge: proposed.judge,
      }),
    ]);
  });

  it('says why it could not request judging, and the replay records that as the entry’s answer', async () => {
    const event = await wanted();
    insights.pairAnswer = 'unavailable';

    const [failed] = (await new RequestReplaySideBySideJudging(
      memory.replayRepository,
      memory.candidateRepository,
      insights,
    ).requested(event)) as ReplayPairingFailed[];
    await new RecordReplayPairVerdict(
      memory.replayRepository,
      TRANSACTION,
    ).requestFailed(failed as ReplayPairingFailed);

    expect(failed?.why).toBe('unavailable');
    expect(
      (await memory.replayRepository.find(event.replayId))?.entries[0]?.pairing
        ?.unpaired,
    ).toBe('unavailable');
  });

  it('records the verdict it received, with what it cost', async () => {
    const event = await wanted();

    await new RecordReplayPairVerdict(
      memory.replayRepository,
      TRANSACTION,
    ).paired({
      runId: event.run.value,
      otherRunId: event.other.value,
      winner: 'other',
      model: 'judge/model',
      passes: [
        { runShownFirst: true, winner: 'other', reasons: [] },
        { runShownFirst: false, winner: 'other', reasons: [] },
      ],
      spent: ModelSpent.of([Money.of(0.02, 'USD')], 0),
    });

    const entry = (await memory.replayRepository.find(event.replayId))
      ?.entries[0];
    expect(entry?.pairing?.verdict?.outcome).toBe('loss');
    expect(entry?.pairingSpent?.spends[0]?.amount).toBe(0.02);
  });
});
