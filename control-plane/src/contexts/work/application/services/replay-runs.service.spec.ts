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
let held: Map<string, Run>;
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
    withdrawn: () => ({ ...run, state: 'withdrawn', hasEnded: true }),
    letGo: () => ({ ...run, stopRequested: true }),
  };

  return run as unknown as Run;
};

const runs = {
  findById: async (id: RunId) => held.get(id.value) ?? null,
  save: async (run: Run) => {
    saved.push(`${run.id.value}:${run.state}`);
  },
} as unknown as RunRepository;

const claiming: ReplayRunClaimsPort = {
  claim: async (first) => {
    const held = claims.get(first.runId.value) ?? first;
    claims.set(first.runId.value, held);
    return held;
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
      standing: async () => ({ line: {}, station: {}, kept: {} }),
      withStation: async () => ({ ok: true, line: {}, station: {} }),
    } as unknown as CandidateLines,
    {
      alreadyQueued: async (id: RunId) => held.has(id.value),
      enqueue: async ({ id }: { id: RunId }) => {
        enqueued.push(id.value);
        held.set(id.value, aRun({ id: id.value, replayOf: ORIGINAL }));
        return id;
      },
    } as unknown as DispatchReplay,
    {
      has: async (_original: Run, answer: string) => answer === 'accepted',
    } as unknown as ReplayAnswers,
    { run: (work) => work() },
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
  held = new Map([[ORIGINAL, aRun({ id: ORIGINAL, state: 'completed' })]]);
  saved = [];
  enqueued = [];
});

describe('ReplayRuns', () => {
  it('says which runs have an answer to hand a replay', async () => {
    held.set(ORIGINAL, aRun({ id: ORIGINAL }));

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
      refusal: 'unknown-run',
    });
    expect(await replayRuns().enqueue(order())).toMatchObject({
      outcome: 'unreplayable',
      refusal: 'unknown-run',
    });
    expect(claims.get(REPLAY)?.claimedAs).toBe('refused');
    expect(await replayRuns().forgo(REPLAY, false)).toEqual({
      outcome: 'never-queued',
    });
    expect(enqueued).toEqual([]);
  });

  it('leaves a tombstone when it forgoes a run never queued, so a later queueing of it is refused', async () => {
    expect(await replayRuns().forgo(REPLAY, false)).toEqual({
      outcome: 'never-queued',
    });
    expect(await replayRuns().enqueue(order())).toMatchObject({
      outcome: 'unreplayable',
      refusal: 'forgone',
    });
    expect(enqueued).toEqual([]);
  });

  it('stops a queued run it forgoes, saying it was queued and under which fingerprint', async () => {
    await replayRuns().enqueue(order());

    expect(await replayRuns().forgo(REPLAY, false)).toEqual({
      outcome: 'queued',
      fingerprint: 'f'.repeat(64),
    });
    expect(saved).toEqual([`${REPLAY}:withdrawn`]);
  });

  it('keeps a queued run it is asked to keep, only saying it was queued', async () => {
    await replayRuns().enqueue(order());

    expect(await replayRuns().forgo(REPLAY, true)).toMatchObject({
      outcome: 'queued',
    });
    expect(saved).toEqual([]);
  });

  it('takes a claim left by a queueing that was refused as never queued, and tombstones it', async () => {
    claims.set(REPLAY, ReplayRunClaim.toQueue(RunId.of(REPLAY)));

    expect(await replayRuns().forgo(REPLAY, false)).toEqual({
      outcome: 'never-queued',
    });
    expect(await replayRuns().enqueue(order())).toMatchObject({
      refusal: 'forgone',
    });
  });
});
