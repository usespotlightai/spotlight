import { JudgingError } from '@insights/application/errors/judging.error';
import type { RunEvidence } from '@insights/application/ports/evidence.port';
import type { JudgeRequest } from '@insights/application/ports/judge.port';
import { WorkJudgings } from '@insights/application/services/work-judgings.service';
import type { RunJudged } from '@insights/domain/events/run-judged.event';
import {
  JudgingsInMemory,
  queuedJudging,
} from '@insights/domain/judging.fake-spec';
import { inTransaction } from '@insights/domain/runs.fake-spec';
import type { Verdict } from '@insights/domain/services/grounded-verdict';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-30T10:05:00.000Z');

const EVIDENCE: RunEvidence = {
  runId: 'run_1',
  taskId: 'task_1',
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
};

const logger: LoggerPort = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const working = async (
  answer: (request: JudgeRequest) => Promise<Verdict>,
  evidence: RunEvidence | null = EVIDENCE,
) => {
  const judgings = new JudgingsInMemory();
  await judgings.add(queuedJudging());
  const requests: JudgeRequest[] = [];
  const work = new WorkJudgings(
    judgings,
    {
      hasTask: async () => true,
      of: async () => evidence,
      judgesOnTeam: async () => new Map(),
      judgeAt: async () => null,
    },
    {
      available: true,
      model: 'some/model',
      judge: async (request) => {
        requests.push(request);
        return { verdict: await answer(request), usage: null };
      },
    },
    { now: () => NOW, sleep: async () => {} },
    inTransaction,
    logger,
    { report: () => undefined },
  );

  await work.processDue();
  await work.idle();

  return {
    requests,
    judgings,
    judging: await judgings.of(RunId.of('run_1')),
  };
};

describe('WorkJudgings', () => {
  it('judges the run on its rubric, steps and hunks, and records the grounded verdict', async () => {
    const { requests, judging, judgings } = await working(async () => ({
      value: true,
      reasons: [
        { text: 'It retries.', steps: [2], hunks: ['api/src/uploads.ts#1'] },
      ],
    }));

    expect(requests[0]?.rubric).toBe('Did the run retry uploads?');
    expect(requests[0]?.scale).toBe('yes-no');
    expect(requests[0]?.steps.map((each) => each.index)).toEqual([2]);
    expect(requests[0]?.hunks.map((each) => each.id)).toEqual([
      'api/src/uploads.ts#1',
    ]);
    expect(judging?.hasPendingJob).toBe(false);
    const [event] = judgings.events as RunJudged[];
    expect(event?.kind).toBe('judging.judged');
    expect(event?.model).toBe('some/model');
  });

  it('fails where the run’s evidence is gone', async () => {
    const { requests, judging } = await working(
      async () => ({ value: true, reasons: [] }),
      null,
    );

    expect(requests).toEqual([]);
    expect(judging?.failure?.code).toBe('no-evidence');
  });

  it('retries later when the request to the provider fails', async () => {
    const { judging } = await working(async () => {
      throw new JudgingError('request-failed', 'no credits', null);
    });

    expect(judging?.hasPendingJob).toBe(true);
    expect(judging?.job?.nextAttemptAt?.getTime()).toBeGreaterThan(
      NOW.getTime(),
    );
  });

  it('retries later when no reason cites what the judge read', async () => {
    const { judging, judgings } = await working(async () => ({
      value: false,
      reasons: [{ text: 'Made up.', steps: [40], hunks: [] }],
    }));

    expect(judging?.hasPendingJob).toBe(true);
    expect(judgings.events).toEqual([]);
  });
});
