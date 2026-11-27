import type { RunEvidence } from '@insights/application/ports/evidence.port';
import type {
  JudgePort,
  JudgeRequest,
} from '@insights/application/ports/judge.port';
import {
  SESSION_WAITING,
  type SessionFailed,
  type SessionWaiting,
} from '@insights/application/ports/session-outcomes';
import { WorkJudgings } from '@insights/application/services/work-judgings.service';
import { RunJudged } from '@insights/domain/events/run-judged.event';
import type { Verdict } from '@insights/domain/services/grounded-verdict';
import { JudgingRound } from '@insights/domain/value-objects/judging-round.vo';
import { AssistJudge } from '@insights/infrastructure/judging/assist-judge';
import { judgeRoundOf } from '@insights/infrastructure/judging/assist-rounds';
import {
  FakeAssistSessions,
  submitted,
} from '@insights/infrastructure/judging/assist-sessions.fake-spec';
import {
  CLAIMS,
  JudgingsInMemory,
  NEXT_RUBRIC_VERSION,
  queuedJudging,
  RUBRIC_VERSION,
  rubricOf,
} from '@insights/judging.fake-spec';
import { inTransaction } from '@insights/runs.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { instanceOf } from '@shared-kernel/domain/instance-of.fake-spec';
import { firstOf } from '@shared-kernel/domain/item-at';
import { WAIT_MS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-30T10:05:00.000Z');

const EVIDENCE: RunEvidence = {
  runId: RunId.of('run_1'),
  taskId: TaskId.of('task_1'),
  title: 'Retry uploads',
  description: 'They fail on a flaky network.',
  steps: [
    {
      index: 2,
      kind: 'message',
      tool: null,
      text: 'Retrying in the request.',
      input: null,
      output: null,
    },
  ],
  hunks: [
    {
      id: 'api/src/uploads.ts#1',
      path: 'api/src/uploads.ts',
      header: '@@ -1 +1 @@',
      lines: ['-upload()', '+retry(upload)'],
    },
  ],
  blockedTools: [],
};

const logger: LoggerPort = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const workOn = (
  judgings: JudgingsInMemory,
  judge: JudgePort,
  evidence: RunEvidence | null = EVIDENCE,
  now: () => Date = () => NOW,
) =>
  new WorkJudgings(
    judgings,
    {
      hasTask: async () => true,
      of: async () => evidence,
    },
    judge,
    { now, sleep: async () => {} },
    inTransaction,
    logger,
    { report: () => undefined },
    telemetryInMemory(),
  );

const working = async (
  answer: (
    request: JudgeRequest,
  ) => Promise<Verdict | SessionFailed | SessionWaiting>,
  evidence: RunEvidence | null = EVIDENCE,
) => {
  const judgings = new JudgingsInMemory();
  await judgings.add(queuedJudging());
  const requests: JudgeRequest[] = [];
  const work = workOn(
    judgings,
    {
      judge: async (request) => {
        requests.push(request);
        const verdict = await answer(request);

        return 'status' in verdict
          ? verdict
          : {
              status: 'judged',
              model: 'some/model',
              verdict,
              guidance: null,
            };
      },
      roundOf: () => null,
    },
    evidence,
  );

  await work.processDue();
  await work.idle();

  return {
    requests,
    judgings,
    judging: await judgings.of(RunId.of('run_1')),
  };
};

const VERDICT_MET = {
  claims: CLAIMS.map((_, index) => ({
    index,
    met: true,
    reasons: [
      { text: 'It retries.', steps: [2], hunks: ['api/src/uploads.ts#1'] },
    ],
  })),
};

const everyClaim = (
  met: boolean,
  reason: { text: string; steps: number[]; hunks: string[] },
): Verdict => ({
  claims: CLAIMS.map((_, index) => ({ index, met, reasons: [reason] })),
});

describe('WorkJudgings', () => {
  it('judges the run on its claims, steps and hunks, and records the grounded verdict', async () => {
    const { requests, judging, judgings } = await working(async () =>
      everyClaim(true, {
        text: 'It retries.',
        steps: [2],
        hunks: ['api/src/uploads.ts#1'],
      }),
    );

    expect(requests[0]?.claims).toEqual(CLAIMS);
    expect(requests[0]?.round).toEqual({
      of: 'judging',
      round: JudgingRound.of({
        runId: RunId.of('run_1'),
        rubricVersion: RUBRIC_VERSION,
        attempt: 1,
      }),
    });
    expect(requests[0]?.guidanceRequested).toBe(false);
    expect(requests[0]?.effectsBlocked).toBe(false);
    expect(requests[0]?.steps.map((each) => each.index)).toEqual([2]);
    expect(requests[0]?.hunks.map((each) => each.id)).toEqual([
      'api/src/uploads.ts#1',
    ]);
    expect(judging?.hasPendingJob).toBe(false);
    const event = instanceOf(RunJudged, firstOf(judgings.events));
    expect(event.kind).toBe('judging.judged');
    expect(event.model).toBe('some/model');
  });

  it('fails where the run’s evidence is gone', async () => {
    const { requests, judging } = await working(
      async () => ({ claims: [] }),
      null,
    );

    expect(requests).toEqual([]);
    expect(judging?.failure?.code).toBe('no-evidence');
  });

  it('retries later when the request to the provider fails', async () => {
    const { judging } = await working(async () => ({
      status: 'failed',
      failure: 'request-failed',
    }));

    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.job?.nextAttemptAt?.getTime()).toBeGreaterThan(
      NOW.getTime(),
    );
  });

  it('waits for the judging session without spending the attempt, and asks for the same session again', async () => {
    const { judging, requests } = await working(async () => SESSION_WAITING);

    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.job?.attempts).toBe(0);
    expect(judging?.job?.nextAttemptAt).toEqual(
      new Date(NOW.getTime() + WAIT_MS),
    );
    expect(requests.map((each) => each.round.of)).toEqual(['judging']);
  });

  it('fails for good when there is no harness to judge on', async () => {
    const { judging } = await working(async () => ({
      status: 'failed',
      failure: 'unavailable',
    }));

    expect(judging?.hasPendingJob).toBe(false);
    expect(judging?.failure?.code).toBe('unavailable');
  });

  it('retries later when no reason cites what the judge read', async () => {
    const { judging, judgings } = await working(async () =>
      everyClaim(false, { text: 'Made up.', steps: [40], hunks: [] }),
    );

    expect(judging?.hasPendingJob).toBe(true);
    expect(judgings.events).toEqual([]);
  });

  it('orders a new judging session for a run judged again on a new rubric', async () => {
    const judgings = new JudgingsInMemory();
    const sessions = new FakeAssistSessions(submitted(VERDICT_MET));
    const work = workOn(judgings, new AssistJudge(sessions));
    await judgings.add(queuedJudging());

    await work.processDue();
    await work.idle();
    const judged = await judgings.of(RunId.of('run_1'));
    await judgings.save(
      judged?.rejudged(rubricOf(NEXT_RUBRIC_VERSION), NOW) ?? queuedJudging(),
    );
    await work.processDue();
    await work.idle();

    expect(sessions.orders.map((each) => each.key)).toEqual([
      `judging:run_1:${RUBRIC_VERSION}:1`,
      `judging:run_1:${NEXT_RUBRIC_VERSION}:1`,
    ]);
    expect((await judgings.of(RunId.of('run_1')))?.hasPendingJob).toBe(false);
  });

  it('wakes the judging that waits on a settled session, once', async () => {
    const judgings = new JudgingsInMemory();
    const sessions = new FakeAssistSessions();
    const later = new Date(NOW.getTime() + 1_000);
    let now = NOW;
    const work = workOn(
      judgings,
      new AssistJudge(sessions),
      EVIDENCE,
      () => now,
    );
    await judgings.add(queuedJudging());
    await work.processDue();
    await work.idle();
    const order = firstOf(sessions.orders);
    const session = {
      workspaceId: 'ws_1',
      purpose: order?.purpose ?? '',
      key: order?.key ?? '',
    };
    now = later;

    await work.sessionSettled(session);
    const woken = await judgings.of(RunId.of('run_1'));
    await work.sessionSettled(session);

    expect(judgeRoundOf(session)?.of).toBe('judging');
    expect(woken?.job?.nextAttemptAt).toEqual(later);
    expect((await judgings.of(RunId.of('run_1')))?.version).toBe(
      woken?.version,
    );
  });

  it('leaves a judging alone when a session of another workspace or round settles', async () => {
    const judgings = new JudgingsInMemory();
    const sessions = new FakeAssistSessions();
    const work = workOn(judgings, new AssistJudge(sessions));
    await judgings.add(queuedJudging());
    await work.processDue();
    await work.idle();
    const waiting = await judgings.of(RunId.of('run_1'));

    await work.sessionSettled({
      workspaceId: 'ws_2',
      purpose: 'insights.judge',
      key: sessions.orders[0]?.key ?? '',
    });
    await work.sessionSettled({
      workspaceId: 'ws_1',
      purpose: 'insights.judge',
      key: `judging:run_1:${RUBRIC_VERSION}:2`,
    });

    expect((await judgings.of(RunId.of('run_1')))?.job).toEqual(waiting?.job);
  });
});
