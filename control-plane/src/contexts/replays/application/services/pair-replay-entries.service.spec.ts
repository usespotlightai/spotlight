import {
  FakePairJudge,
  InMemorySideBySideJudgings,
  sideBySideJudgingRequestsFor,
} from '@replays/application/services/judgings.fake-spec';
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
import { PairVerdict } from '@replays/domain/value-objects/entry-pairing.vo';
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

const concludedOwn = async () =>
  pairing().concluded(
    concludedEvent(
      (await memory.replayRepository.find(ReplayId.of('replay_1'))) as Replay,
    ),
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
  const sideBySideOf = () =>
    memory.events
      .filter(
        (each): each is ReplaySideBySideJudgingRequested =>
          each.kind === 'replay.side-by-side-judging-requested',
      )
      .map((each) => each.replayId.value);

  it('pairs, from a baseline’s concluded entry, each replay set beside it', async () => {
    const baseline = await memory.replayRepository.find(
      ReplayId.of('baseline_1'),
    );

    await pairing().concluded(concludedEvent(baseline as Replay));

    expect(new Set(sideBySideOf())).toEqual(new Set(['replay_1']));
  });

  it('pairs, from a replay’s own concluded entry, only that replay, and none once it was stopped', async () => {
    const replay = (await memory.replayRepository.find(
      ReplayId.of('replay_1'),
    )) as Replay;

    await pairing().concluded(concludedEvent(replay));
    expect(new Set(sideBySideOf())).toEqual(new Set(['replay_1']));

    memory.events.length = 0;
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

    await pairing().concluded(concludedEvent(baseline));
    expect(sideBySideOf()).not.toContain('replay_2');
  });

  it('requests a side-by-side judging only for tasks people accepted a change for', async () => {
    insights.accepted.delete('original_1');

    await concludedOwn();

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

    await concludedOwn();

    expect(memory.events).toEqual([]);
  });
});

describe('RequestReplaySideBySideJudging and RecordReplayPairVerdict', () => {
  const wanted = async () => {
    await concludedOwn();

    return memory.events.find(
      (each): each is ReplaySideBySideJudgingRequested =>
        each.kind === 'replay.side-by-side-judging-requested',
    ) as ReplaySideBySideJudgingRequested;
  };

  const requesting = (
    judge: FakePairJudge,
    judgings = new InMemorySideBySideJudgings(),
  ) =>
    new RequestReplaySideBySideJudging(
      memory.replayRepository,
      memory.candidateRepository,
      sideBySideJudgingRequestsFor(judgings, judge),
      new RecordReplayPairVerdict(memory.replayRepository, TRANSACTION),
    );

  it('requests judging with the candidate’s criteria and the original as the reference', async () => {
    const event = await wanted();
    const judgings = new InMemorySideBySideJudgings();

    await requesting(new FakePairJudge(), judgings).requested(event);

    const [judging] = [...judgings.stored.values()];
    expect(judging?.runId).toEqual(RunId.of('replay_1_run_0'));
    expect(judging?.otherRunId).toEqual(RunId.of('baseline_1_run_0'));
    expect(judging?.reference).toEqual(RunId.of('original_0'));
    expect(proposed.judge && judging?.criteria.equals(proposed.judge)).toBe(
      true,
    );
  });

  it('says why it could not request judging, and the replay records that as the entry’s answer', async () => {
    const event = await wanted();
    const judge = new FakePairJudge();
    judge.available = false;

    await requesting(judge).requested(event);

    expect(
      (await memory.replayRepository.find(event.replayId))?.entries[0]?.pairing
        ?.unpaired,
    ).toBe('unavailable');
  });

  it('records the verdict it received', async () => {
    const event = await wanted();

    await new RecordReplayPairVerdict(
      memory.replayRepository,
      TRANSACTION,
    ).paired(
      event.run,
      event.other,
      PairVerdict.of({
        outcome: 'loss',
        model: 'judge/model',
        passes: [
          { ownShownFirst: true, outcome: 'loss', reasons: [] },
          { ownShownFirst: false, outcome: 'loss', reasons: [] },
        ],
      }),
    );

    const entry = (await memory.replayRepository.find(event.replayId))
      ?.entries[0];
    expect(entry?.pairing?.verdict?.outcome).toBe('loss');
  });
});
