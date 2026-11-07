import type {
  QueuedRunCancellation,
  ReplayTrialRun,
  RunEnqueueing,
  RunStatus,
  RunsPort,
} from '@replays/application/ports/runs.port';
import type {
  StationTrialsPort,
  TrialOrdering,
  TrialRequest,
} from '@replays/application/ports/station-trials.port';
import {
  ReplayRunDispatch,
  type ReplayRunOrder,
} from '@replays/application/services/replay-run-dispatch.service';
import { InMemoryReplayRunDecisions } from '@replays/application/services/replays.fake-spec';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import { MovesOnWords } from '@replays/domain/value-objects/moves-on-words.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaysRequester } from '@replays/domain/value-objects/replays-requester.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const RUN = RunId.of('run_trial');
const FINGERPRINT = StationFingerprint.of('f'.repeat(64));

const OWNER = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  replayId: ReplayId.of('replay_1'),
};

const ORDER: ReplayRunOrder = {
  run: RUN,
  owner: OWNER,
  original: RunId.of('run_original'),
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
  block: StationBlock.of({ key: 'build', name: 'Build', kind: 'work' }),
  line: null,
  answer: null,
};

const ORDERED: TrialOrdering = {
  ordered: true,
  trial: {
    fingerprint: FINGERPRINT,
    movesOnAfter: MovesOnWords.of(['Ship', 'done']),
  },
};

class FakeTrials implements StationTrialsPort {
  ordering: TrialOrdering = ORDERED;
  readonly requests: TrialRequest[] = [];
  readonly withdrawn: string[] = [];
  onOrder: () => Promise<void> = async () => {};

  answers = async () => [];

  order = async (request: TrialRequest) => {
    this.requests.push(request);
    await this.onOrder();
    return this.ordering;
  };

  withdraw = async (run: RunId) => {
    this.withdrawn.push(run.value);
  };
}

class FakeRuns implements RunsPort {
  readonly enqueued: ReplayTrialRun[] = [];
  readonly cancelled: string[] = [];
  readonly known = new Set<string>();
  enqueueing: RunEnqueueing = { outcome: 'enqueued' };
  queued: QueuedRunCancellation = { outcome: 'cancelled', started: false };
  onEnqueue: () => Promise<void> = async () => {};

  enqueueTrial = async (run: ReplayTrialRun) => {
    this.enqueued.push(run);
    if (this.enqueueing.outcome === 'enqueued') {
      this.known.add(run.run.value);
    }
    await this.onEnqueue();
    return this.enqueueing;
  };

  enqueueSearch = async () => this.enqueueing;

  cancel = async (run: RunId) => {
    this.cancelled.push(run.value);
    return { known: this.known.has(run.value) };
  };

  cancelIfQueued = async (run: RunId) =>
    this.known.has(run.value) ? this.queued : ({ outcome: 'unknown' } as const);

  statuses = async (runs: readonly RunId[]): Promise<RunStatus[]> =>
    runs
      .filter((each) => this.known.has(each.value))
      .map((each) => ({
        run: each,
        requester: ReplaysRequester.replayOf(each),
        state: 'queued',
        askedAPerson: false,
        started: false,
        queuedAt: new Date(0),
        endedAt: null,
      }));

  leasedBy = async () => null;

  agentProblem = () => null;
}

let decisions: InMemoryReplayRunDecisions;
let trials: FakeTrials;
let runs: FakeRuns;
let dispatch: ReplayRunDispatch;
let replayKept: boolean;

beforeEach(() => {
  decisions = new InMemoryReplayRunDecisions();
  trials = new FakeTrials();
  runs = new FakeRuns();
  replayKept = true;
  dispatch = new ReplayRunDispatch(
    decisions,
    { find: async () => (replayKept ? ({} as Replay) : null) },
    trials,
    runs,
  );
});

describe('ReplayRunDispatch', () => {
  it('orders the trial from Work and enqueues it as an isolated replay run', async () => {
    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: true,
      fingerprint: FINGERPRINT,
    });

    expect(runs.enqueued).toEqual([{ run: RUN, trial: ORDERED.trial }]);
    expect((await decisions.find(RUN))?.trial?.movesOnAfter.words).toEqual([
      'ship',
      'done',
    ]);
  });

  it('records why Work cannot try the run, and enqueues nothing', async () => {
    trials.ordering = {
      ordered: false,
      unreplayableReason: 'archive-gone',
    };

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'archive-gone',
    });
    expect(runs.enqueued).toEqual([]);
    expect((await decisions.find(RUN))?.decided).toBe('unreplayable');
  });

  it('withdraws the trial when the run cannot be enqueued', async () => {
    runs.enqueueing = { outcome: 'refused' };

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cannot-start',
    });
    expect(trials.withdrawn).toEqual([RUN.value]);
  });

  it('keeps no decision and queues nothing for a replay deleted before the dispatch (R5-07)', async () => {
    replayKept = false;

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cancelled',
    });
    expect(await decisions.find(RUN)).toBeNull();
    expect(trials.requests).toEqual([]);
  });

  it('queues nothing once a cancel decided the run first', async () => {
    await decisions.add(ReplayRunDecision.decidedToCancel(RUN, OWNER));

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cancelled',
    });
    expect(trials.requests).toEqual([]);
  });

  it('cancels the run it enqueued when a cancel decided the run meanwhile', async () => {
    runs.onEnqueue = async () => {
      await dispatch.cancel(RUN, OWNER, false);
    };

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cancelled',
    });
    expect(runs.cancelled).toContain(RUN.value);
  });

  it('withdraws the trial when a cancel decided the run before it was enqueued', async () => {
    trials.onOrder = async () => {
      await dispatch.cancel(RUN, OWNER, false);
    };

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cancelled',
    });
    expect(runs.enqueued).toEqual([]);
    expect(new Set(trials.withdrawn)).toEqual(new Set([RUN.value]));
  });

  describe('cancel', () => {
    it('never queues a run nobody decided yet', async () => {
      expect(await dispatch.cancel(RUN, OWNER, false)).toEqual({
        wasQueued: false,
      });
      expect((await decisions.find(RUN))?.decided).toBe('cancelled');
    });

    it('stops a queued run and confirms it with its config', async () => {
      await dispatch.dispatch(ORDER);

      expect(await dispatch.cancel(RUN, OWNER, false)).toEqual({
        wasQueued: true,
        fingerprint: FINGERPRINT,
      });
      expect((await decisions.find(RUN))?.decided).toBe('cancelled');
    });

    it('leaves a run as it is when asked to, and confirms it', async () => {
      await dispatch.dispatch(ORDER);

      expect(await dispatch.cancel(RUN, OWNER, true)).toEqual({
        wasQueued: true,
        fingerprint: FINGERPRINT,
      });
      expect(runs.cancelled).toEqual([]);
      expect((await decisions.find(RUN))?.mayQueue).toBe(true);
    });

    it('cancels a decision whose run was never created', async () => {
      await decisions.add(ReplayRunDecision.decidedToQueue(RUN, OWNER));

      expect(await dispatch.cancel(RUN, OWNER, true)).toEqual({
        wasQueued: false,
      });
      expect((await decisions.find(RUN))?.decided).toBe('cancelled');
      expect(trials.withdrawn).toEqual([RUN.value]);
    });

    it('withdraws a trial Work stored when the run was never enqueued', async () => {
      runs.onEnqueue = async () => {
        throw new Error('the process stopped');
      };
      await expect(dispatch.dispatch(ORDER)).rejects.toThrow();
      runs.known.clear();

      expect(await dispatch.cancel(RUN, OWNER, false)).toEqual({
        wasQueued: false,
      });
      expect(trials.withdrawn).toEqual([RUN.value]);
    });
  });
});
