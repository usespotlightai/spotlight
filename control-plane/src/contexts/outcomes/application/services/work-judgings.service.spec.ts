import { JudgingError } from '@outcomes/application/errors/judging.error';
import type { RunEvidence } from '@outcomes/application/ports/evidence.port';
import type { JudgeAsk } from '@outcomes/application/ports/judge.port';
import { WorkJudgings } from '@outcomes/application/services/work-judgings.service';
import type { Verdict } from '@outcomes/domain/aggregates/judging.aggregate';
import type { RunJudged } from '@outcomes/domain/events/run-judged.event';
import {
  askedJudging,
  JudgingsInMemory,
} from '@outcomes/domain/judging.fake-spec';
import { inTransaction } from '@outcomes/domain/outcomes.fake-spec';
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
      kind: 'said',
      tool: null,
      text: 'Retrying in the request.',
      given: null,
      returned: null,
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
  answer: (ask: JudgeAsk) => Promise<Verdict>,
  evidence: RunEvidence | null = EVIDENCE,
) => {
  const judgings = new JudgingsInMemory();
  await judgings.add(askedJudging());
  const asked: JudgeAsk[] = [];
  const work = new WorkJudgings(
    judgings,
    {
      holds: async () => true,
      of: async () => evidence,
      judgeAt: async () => null,
    },
    {
      available: true,
      model: 'some/model',
      judge: (ask) => {
        asked.push(ask);
        return answer(ask);
      },
    },
    { now: () => NOW, sleep: async () => {} },
    inTransaction,
    logger,
  );

  await work.workDue();
  await work.idle();

  return {
    asked,
    judgings,
    judging: await judgings.of(RunId.of('run_1')),
  };
};

describe('WorkJudgings', () => {
  it('judges the run on its rubric, steps and hunks, and records the grounded verdict', async () => {
    const { asked, judging, judgings } = await working(async () => ({
      value: true,
      reasons: [
        { text: 'It retries.', steps: [2], hunks: ['api/src/uploads.ts#1'] },
      ],
    }));

    expect(asked[0]?.rubric).toBe('Did the run retry uploads?');
    expect(asked[0]?.scale).toBe('yes-no');
    expect(asked[0]?.steps.map((each) => each.index)).toEqual([2]);
    expect(asked[0]?.hunks.map((each) => each.id)).toEqual([
      'api/src/uploads.ts#1',
    ]);
    expect(judging?.owesWork).toBe(false);
    const [event] = judgings.events as RunJudged[];
    expect(event?.kind).toBe('judging.judged');
    expect(event?.model).toBe('some/model');
  });

  it('gives up where the run’s evidence is gone', async () => {
    const { asked, judging } = await working(
      async () => ({ value: true, reasons: [] }),
      null,
    );

    expect(asked).toEqual([]);
    expect(judging?.failure?.code).toBe('no-evidence');
  });

  it('tries again later when the provider refuses', async () => {
    const { judging } = await working(async () => {
      throw new JudgingError('refused', 'no credits');
    });

    expect(judging?.owesWork).toBe(true);
    expect(judging?.work?.dueAt?.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('tries again later when no reason cites what the judge read', async () => {
    const { judging, judgings } = await working(async () => ({
      value: false,
      reasons: [{ text: 'Made up.', steps: [40], hunks: [] }],
    }));

    expect(judging?.owesWork).toBe(true);
    expect(judgings.events).toEqual([]);
  });
});
