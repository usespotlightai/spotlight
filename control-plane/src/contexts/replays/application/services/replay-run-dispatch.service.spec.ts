import type {
  QueuedRunCancellation,
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
import { InMemoryReplayRunClaims } from '@replays/application/services/replays.fake-spec';
import { ReplayRunClaim } from '@replays/domain/aggregates/replay-run-claim.aggregate';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunOrderContract } from '@work/application/contracts/run-order.contract';
import { beforeEach, describe, expect, it } from 'vitest';

const RUN = RunId.of('run_trial');
const FINGERPRINT = StationFingerprint.of('f'.repeat(64));

const ORDER: ReplayRunOrder = {
  run: RUN,
  original: RunId.of('run_original'),
  workspaceId: WorkspaceId.of('ws_1'),
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
  block: StationBlock.of({ key: 'build', name: 'Build', kind: 'work' }),
  line: null,
  answer: null,
};

const ORDERED: TrialOrdering = {
  ordered: true,
  order: {
    runId: RUN.value,
    workspaceId: 'ws_1',
    harness: 'claude-code',
    priority: -1,
    placement: { labelGroups: [], image: null },
    spec: {
      command: { executable: 'claude', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: ['ship'], noteLimit: 0 },
      resume: {},
    },
    restore: { archive: 'archive_1' },
    refusal: null,
  },
  team: 'team_1',
  fingerprint: FINGERPRINT,
  checkouts: [{ path: 'api', repository: 'acme/api', commit: 'abc' }],
  movesOnAfter: ['ship', 'done'],
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
  readonly enqueued: RunOrderContract[] = [];
  readonly cancelled: string[] = [];
  readonly known = new Set<string>();
  enqueueing: RunEnqueueing = { enqueued: true };
  queued: QueuedRunCancellation = { outcome: 'cancelled', started: false };
  onEnqueue: () => Promise<void> = async () => {};

  enqueue = async (order: RunOrderContract) => {
    this.enqueued.push(order);
    if (this.enqueueing.enqueued) {
      this.known.add(order.runId);
    }
    await this.onEnqueue();
    return this.enqueueing;
  };

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
        requester: {
          owner: 'replays',
          kind: 'replay',
          id: each.value,
          token: null,
          team: 'team_1',
        },
        state: 'queued',
        askedAPerson: false,
        started: false,
        queuedAt: new Date(0),
        endedAt: null,
      }));

  leasedBy = async () => null;

  agentProblem = () => null;

  commandFor = () => null;
}

let claims: InMemoryReplayRunClaims;
let trials: FakeTrials;
let runs: FakeRuns;
let dispatch: ReplayRunDispatch;

beforeEach(() => {
  claims = new InMemoryReplayRunClaims();
  trials = new FakeTrials();
  runs = new FakeRuns();
  dispatch = new ReplayRunDispatch(claims, trials, runs);
});

describe('ReplayRunDispatch', () => {
  it('orders the trial from Work and enqueues it as an isolated replay run', async () => {
    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: true,
      fingerprint: FINGERPRINT,
    });

    const [order] = runs.enqueued;
    expect(order?.requester).toEqual({
      owner: 'replays',
      kind: 'replay',
      id: RUN.value,
      token: null,
      team: 'team_1',
    });
    expect(order?.policy).toMatchObject({
      holdsTurn: false,
      gated: false,
      actsBeyondItself: false,
      asks: 'recorded',
      listed: false,
      exclusive: false,
    });
    expect(order?.workspace?.key).toBe(`replays/replay-${RUN.value}`);
    expect(order?.extensions.replay).toEqual({
      archive: 'archive_1',
      checkouts: [{ path: 'api', commit: 'abc', repository: 'acme/api' }],
      movesOnAfter: ['ship', 'done'],
    });
    expect(order?.restore).toEqual({ archive: 'archive_1' });
    expect((await claims.find(RUN))?.trial?.movesOnAfter).toEqual([
      'ship',
      'done',
    ]);
  });

  it('records why Work cannot try the run, and enqueues nothing', async () => {
    trials.ordering = {
      ordered: false,
      unreplayableReason: 'archive-gone',
      reason: 'The archive is gone.',
    };

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'archive-gone',
    });
    expect(runs.enqueued).toEqual([]);
    expect((await claims.find(RUN))?.claimedAs).toBe('unreplayable');
  });

  it('withdraws the trial when the run cannot be enqueued', async () => {
    runs.enqueueing = { enqueued: false, reason: 'no such harness' };

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cannot-start',
    });
    expect(trials.withdrawn).toEqual([RUN.value]);
  });

  it('queues nothing once a cancel claimed the run first', async () => {
    await claims.add(ReplayRunClaim.toCancel(RUN));

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cancelled',
    });
    expect(trials.requests).toEqual([]);
  });

  it('cancels the run it enqueued when a cancel claimed the run meanwhile', async () => {
    runs.onEnqueue = async () => {
      await dispatch.cancel(RUN, false);
    };

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cancelled',
    });
    expect(runs.cancelled).toContain(RUN.value);
  });

  it('withdraws the trial when a cancel claimed the run before it was enqueued', async () => {
    trials.onOrder = async () => {
      await dispatch.cancel(RUN, false);
    };

    expect(await dispatch.dispatch(ORDER)).toEqual({
      queued: false,
      unreplayableReason: 'cancelled',
    });
    expect(runs.enqueued).toEqual([]);
    expect(trials.withdrawn).toEqual([RUN.value]);
  });

  describe('cancel', () => {
    it('never queues a run nobody claimed yet', async () => {
      expect(await dispatch.cancel(RUN, false)).toEqual({ queued: false });
      expect((await claims.find(RUN))?.claimedAs).toBe('cancelled');
    });

    it('stops a queued run and confirms it with its config', async () => {
      await dispatch.dispatch(ORDER);

      expect(await dispatch.cancel(RUN, false)).toEqual({
        queued: true,
        fingerprint: FINGERPRINT,
      });
      expect((await claims.find(RUN))?.claimedAs).toBe('cancelled');
    });

    it('leaves a run as it is when asked to, and confirms it', async () => {
      await dispatch.dispatch(ORDER);

      expect(await dispatch.cancel(RUN, true)).toEqual({
        queued: true,
        fingerprint: FINGERPRINT,
      });
      expect(runs.cancelled).toEqual([]);
      expect((await claims.find(RUN))?.mayQueue).toBe(true);
    });

    it('cancels a claim whose run was never created', async () => {
      await claims.add(ReplayRunClaim.toQueue(RUN));

      expect(await dispatch.cancel(RUN, true)).toEqual({ queued: false });
      expect((await claims.find(RUN))?.claimedAs).toBe('cancelled');
    });
  });
});
