import type { RunEvidence } from '@insights/application/ports/evidence.port';
import type { SideBySideJudgeRequest } from '@insights/application/ports/side-by-side-judge.port';
import { WorkSideBySideJudgings } from '@insights/application/services/work-side-by-side-judgings.service';
import {
  type PairVerdict,
  SideBySideJudging,
} from '@insights/domain/aggregates/side-by-side-judging.aggregate';
import type { SideBySideJudged } from '@insights/domain/events/side-by-side-judged.event';
import type { SideBySideJudgingFailed } from '@insights/domain/events/side-by-side-judging-failed.event';
import {
  claimsCriteria,
  SideBySideJudgingsInMemory,
} from '@insights/domain/judging.fake-spec';
import { inTransaction } from '@insights/domain/runs.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-03T10:05:00.000Z');

const evidenceOf = (runId: string, line: string): RunEvidence => ({
  runId,
  taskId: 'task_1',
  title: 'Drain the queue',
  description: null,
  steps: [],
  hunks: [
    {
      id: 'api/q.ts#1',
      path: 'api/q.ts',
      header: '@@ -1 +1 @@',
      lines: [line],
    },
  ],
});

const logger: LoggerPort = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const working = async (
  answer: (request: SideBySideJudgeRequest) => PairVerdict,
  evidence: Record<string, RunEvidence> = {
    replay_1: evidenceOf('replay_1', '+drainFast()'),
    replay_2: evidenceOf('replay_2', '+drain()'),
    original_1: evidenceOf('original_1', '+drainInOrder()'),
  },
) => {
  const judgings = new SideBySideJudgingsInMemory();
  await judgings.add(
    SideBySideJudging.requested({
      runId: RunId.of('replay_1'),
      otherRunId: RunId.of('replay_2'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      criteria: claimsCriteria(),
      reference: RunId.of('original_1'),
      maxAttempts: 2,
      now: NOW,
    }),
  );
  judgings.events.length = 0;
  const requests: SideBySideJudgeRequest[] = [];
  const work = new WorkSideBySideJudgings(
    judgings,
    {
      hasTask: async () => true,
      of: async (runId) => evidence[runId] ?? null,
      judgesOnTeam: async () => new Map(),
      judgeAt: async () => null,
    },
    {
      available: true,
      model: 'some/model',
      judgePair: async (request) => {
        requests.push(request);
        return {
          verdict: answer(request),
          usage: {
            inputTokens: 900,
            outputTokens: 80,
            cost: { amount: 0.02, currency: 'USD' },
          },
        };
      },
    },
    { now: () => NOW, sleep: async () => {} },
    inTransaction,
    logger,
    { report: () => undefined },
  );

  await work.processDue();
  await work.idle();

  return { requests, judgings };
};

const fastSide = (request: SideBySideJudgeRequest): 'A' | 'B' =>
  request.a.hunks.some((each) => each.lines.includes('+drainFast()'))
    ? 'A'
    : 'B';

describe('WorkSideBySideJudgings', () => {
  it('shows the judge both changes labelled A and B beside the accepted one, once each way round, both calls counting, and names the winner by its run', async () => {
    const { requests, judgings } = await working((request) => ({
      preferred: fastSide(request),
      reasons: [
        { text: 'It drains fast.', hunks: [`${fastSide(request)}:api/q.ts#1`] },
      ],
    }));
    const [event] = judgings.events as SideBySideJudged[];

    expect(requests).toHaveLength(2);
    expect(requests.map(fastSide).sort()).toEqual(['A', 'B']);
    expect(requests[0]?.reference.hunks[0]?.lines).toEqual(['+drainInOrder()']);
    expect(requests[0]?.claims).toHaveLength(3);
    expect(requests[0]?.title).toBe('Drain the queue');
    expect(event?.winner).toBe('run');
    expect(event?.passes).toHaveLength(2);
    expect(event?.spent.costs).toEqual([{ amount: 0.04, currency: 'USD' }]);
  });

  it('fails for good with no change on either side or no accepted change to set beside them', async () => {
    const { requests, judgings } = await working(
      () => ({ preferred: 'tie', reasons: [] }),
      {
        replay_1: evidenceOf('replay_1', '+drainFast()'),
        replay_2: evidenceOf('replay_2', '+drain()'),
      },
    );
    const [event] = judgings.events as SideBySideJudgingFailed[];

    expect(requests).toEqual([]);
    expect(event?.failure.code).toBe('no-evidence');
  });

  it('keeps what the first pass cost and retries later when the second call breaks', async () => {
    let calls = 0;
    const { judgings } = await working((request) => {
      calls += 1;
      if (calls === 2) {
        throw new Error('the connection dropped');
      }
      return {
        preferred: fastSide(request),
        reasons: [
          {
            text: 'It drains fast.',
            hunks: [`${fastSide(request)}:api/q.ts#1`],
          },
        ],
      };
    });
    const [judging] = [...judgings.stored.values()];

    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.spent.costs).toEqual([{ amount: 0.02, currency: 'USD' }]);
    expect(judgings.events).toEqual([]);
  });
});
