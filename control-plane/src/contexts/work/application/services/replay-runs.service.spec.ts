import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ReplayRunClaimsPort } from '@work/application/ports/replay-run-claims.port';
import type { CandidateLines } from '@work/application/services/candidate-lines.service';
import type { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import type { ReplayAnswers } from '@work/application/services/replay-answers.service';
import { ReplayRuns } from '@work/application/services/replay-runs.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL = 'run_original';
const REPLAY = 'run_replay';

let claims: Map<string, ReplayRunClaim>;
let stored: Map<string, Run>;
let saved: string[];
let enqueued: string[];

const aRun = (input: {
  id: string;
  workspaceId?: string;
  state?: string;
  replayOf?: string | null;
}): Run => {
  const run = {
    id: RunId.of(input.id),
    workspaceId: WorkspaceId.of(input.workspaceId ?? 'ws_1'),
    state: input.state ?? 'queued',
    hasEnded: false,
    replayOf: input.replayOf ? RunId.of(input.replayOf) : null,
    configuredAs: { fingerprint: 'f'.repeat(64) },
    cancelQueued: () => ({ ...run, state: 'cancelled', hasEnded: true }),
    cancel: () => ({ ...run, stopRequested: true }),
  };

  return run as unknown as Run;
};

const runs = {
  findById: async (id: RunId) => stored.get(id.value) ?? null,
  save: async (run: Run) => {
    saved.push(`${run.id.value}:${run.state}`);
  },
} as unknown as RunRepository;

const claiming: ReplayRunClaimsPort = {
  claim: async (first) => {
    const taken = claims.get(first.runId.value) ?? first;
    claims.set(first.runId.value, taken);
    return taken;
  },
  save: async (claim) => {
    claims.set(claim.runId.value, claim);
  },
};

const replayRuns = () =>
  new ReplayRuns(
    runs,
    claiming,
    {
      live: async () => ({ line: {}, station: {}, record: {} }),
      withStation: async () => ({ ok: true, line: {}, station: {} }),
    } as unknown as CandidateLines,
    {
      alreadyQueued: async (id: RunId) => stored.has(id.value),
      enqueue: async ({ id }: { id: RunId }) => {
        enqueued.push(id.value);
        stored.set(id.value, aRun({ id: id.value, replayOf: ORIGINAL }));
        return id;
      },
    } as unknown as DispatchReplay,
    {
      has: async (_original: Run, answer: string) => answer === 'accepted',
    } as unknown as ReplayAnswers,
    { inTransaction: (work) => work() },
    { now: () => new Date(), sleep: async () => {} },
  );

const order = (workspaceId = 'ws_1') => ({
  id: REPLAY,
  original: ORIGINAL,
  workspaceId,
  lineId: 'line_1',
  stationId: 'station_1',
  station: { key: 'build' },
});

beforeEach(() => {
  claims = new Map();
  stored = new Map([[ORIGINAL, aRun({ id: ORIGINAL, state: 'completed' })]]);
  saved = [];
  enqueued = [];
});

describe('ReplayRuns', () => {
  it('says which runs have an answer to hand a replay', async () => {
    stored.set(ORIGINAL, aRun({ id: ORIGINAL }));

    await expect(
      replayRuns().answerable([
        { original: ORIGINAL, answer: 'accepted' },
        { original: ORIGINAL, answer: 'sent-back' },
        { original: 'run_unknown', answer: 'accepted' },
      ]),
    ).resolves.toEqual([ORIGINAL]);
  });

  it('queues a replay run once, answering the fingerprint it was queued under', async () => {
    expect(await replayRuns().enqueue(order())).toEqual({
      outcome: 'queued',
      fingerprint: 'f'.repeat(64),
    });
    expect(await replayRuns().enqueue(order())).toMatchObject({
      outcome: 'queued',
    });
    expect(enqueued).toEqual([REPLAY]);
  });

  it('knows no original of another workspace, and answers the same on a retry, leaving no claim to queue it', async () => {
    expect(await replayRuns().enqueue(order('ws_2'))).toMatchObject({
      outcome: 'unreplayable',
      unreplayableReason: 'unknown-run',
    });
    expect(await replayRuns().enqueue(order())).toMatchObject({
      outcome: 'unreplayable',
      unreplayableReason: 'unknown-run',
    });
    expect(claims.get(REPLAY)?.claimedAs).toBe('unreplayable');
    expect(await replayRuns().cancel(REPLAY, false)).toEqual({
      outcome: 'never-queued',
    });
    expect(enqueued).toEqual([]);
  });

  it('leaves a tombstone when it cancels a run never queued, so a later queueing of it is unreplayable', async () => {
    expect(await replayRuns().cancel(REPLAY, false)).toEqual({
      outcome: 'never-queued',
    });
    expect(await replayRuns().enqueue(order())).toMatchObject({
      outcome: 'unreplayable',
      unreplayableReason: 'cancelled',
    });
    expect(enqueued).toEqual([]);
  });

  it('stops a queued run it cancels, saying it was queued and under which fingerprint', async () => {
    await replayRuns().enqueue(order());

    expect(await replayRuns().cancel(REPLAY, false)).toEqual({
      outcome: 'queued',
      fingerprint: 'f'.repeat(64),
    });
    expect(saved).toEqual([`${REPLAY}:cancelled`]);
  });

  it('leaves a queued run running when requested, only saying it was queued', async () => {
    await replayRuns().enqueue(order());

    expect(await replayRuns().cancel(REPLAY, true)).toMatchObject({
      outcome: 'queued',
    });
    expect(saved).toEqual([]);
  });

  it('takes a claim left by a queueing that failed as never queued, and tombstones it', async () => {
    claims.set(REPLAY, ReplayRunClaim.toQueue(RunId.of(REPLAY)));

    expect(await replayRuns().cancel(REPLAY, false)).toEqual({
      outcome: 'never-queued',
    });
    expect(await replayRuns().enqueue(order())).toMatchObject({
      unreplayableReason: 'cancelled',
    });
  });
});
