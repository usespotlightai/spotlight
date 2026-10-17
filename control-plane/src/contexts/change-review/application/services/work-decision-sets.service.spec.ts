import type { DecisionDrafterPort } from '@change-review/application/ports/decision-drafter.port';
import type {
  RunReasoning,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { WorkDecisionSets } from '@change-review/application/services/work-decision-sets.service';
import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import type { ProposedDecision } from '@change-review/domain/entities/decision.entity';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-21T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const RUN = RunId.of('run_1');

const REASONED: RunReasoning = {
  steps: [
    {
      index: 3,
      kind: 'thought',
      text: 'A queue needs a worker we do not run.',
    },
    { index: 7, kind: 'message', text: 'Retrying in the request instead.' },
  ],
  changed: ['api/src/uploads.ts'],
};

const DECIDED: ProposedDecision = {
  kind: 'trade-off',
  title: 'Retries uploads in the request',
  why: 'A queue would need a worker the service does not run.',
  alternatives: ['Retry from a queue'],
  paths: ['api/src/uploads.ts'],
  steps: [3],
};

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const working = (
  reasoning: RunReasoning | null,
  answer: () => Promise<readonly ProposedDecision[]>,
) => {
  let stored = DecisionSet.open({
    id: DecisionSetId.of('set_1'),
    taskId: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
  }).asked(RUN, NOW);
  let now = NOW;
  let ids = 0;
  const draft = vi.fn(answer);

  const sets = {
    forTask: async () => stored,
    save: async (set: DecisionSet) => {
      stored = set;
    },
    nextDueJob: async (at: Date) =>
      stored.draft?.job.isDue(at) ? stored : null,
  } as unknown as DecisionSetRepository;

  const service = new WorkDecisionSets(
    sets,
    { reasoning: async () => reasoning } as unknown as WorkPort,
    { available: true, draft } as DecisionDrafterPort,
    {
      generate: () => {
        ids += 1;
        return `decision_${ids}`;
      },
    },
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { now: () => now, sleep: async () => undefined },
    QUIET,
    { report: () => undefined },
  );

  const tick = async (at: Date = now) => {
    now = at;
    await service.processDue();
    await service.idle();
  };

  return { tick, draft, stored: () => stored };
};

describe('drafting the decisions a run made', () => {
  it('records the decisions its reasoning grounds', async () => {
    const worked = working(REASONED, async () => [
      DECIDED,
      { ...DECIDED, title: 'Cites a step the run does not have', steps: [4] },
    ]);

    await worked.tick();

    expect(worked.draft).toHaveBeenCalledWith(REASONED);
    expect(worked.stored().decisions.map((each) => each.title)).toEqual([
      'Retries uploads in the request',
    ]);
    expect(worked.stored().hasPendingJob).toBe(false);
  });

  it('records none, asking no model, where the run changed nothing', async () => {
    const worked = working({ ...REASONED, changed: [] }, async () => [DECIDED]);

    await worked.tick();

    expect(worked.draft).not.toHaveBeenCalled();
    expect(worked.stored().decisions).toEqual([]);
    expect(worked.stored().decidedIn?.equals(RUN)).toBe(true);
  });

  it('dead-letters the job for a run whose journal cannot be read', async () => {
    const worked = working(null, async () => [DECIDED]);

    await worked.tick();

    expect(worked.stored().hasPendingJob).toBe(false);
    expect(worked.stored().decidedIn).toBeNull();
  });

  it('retries later when drafting fails, then dead-letters the job', async () => {
    const worked = working(REASONED, async () => {
      throw new Error('OpenRouter failed to draft: 503');
    });

    for (let day = 0; day <= MAX_JOB_ATTEMPTS; day += 1) {
      await worked.tick(new Date(NOW.getTime() + day * DAY));
    }

    expect(worked.draft).toHaveBeenCalledTimes(MAX_JOB_ATTEMPTS);
    expect(worked.stored().hasPendingJob).toBe(false);
  });

  it('says so when it cannot read a set it leased', async () => {
    const error = vi.fn();
    const leased = DecisionSet.open({
      id: DecisionSetId.of('set_1'),
      taskId: TaskId.of('task_1'),
      workspaceId: WorkspaceId.of('ws_1'),
    }).asked(RUN, NOW);
    let due: DecisionSet | null = leased;

    const service = new WorkDecisionSets(
      {
        nextDueJob: async () => {
          const found = due;
          due = null;
          return found;
        },
        save: async () => undefined,
        forTask: async () => {
          throw new Error('connection reset');
        },
      } as unknown as DecisionSetRepository,
      {} as WorkPort,
      { available: true, draft: vi.fn() } as DecisionDrafterPort,
      { generate: () => 'decision_1' },
      { inTransaction: <T>(work: () => Promise<T>) => work() },
      { now: () => NOW, sleep: async () => undefined },
      { ...QUIET, error },
      { report: () => undefined },
    );

    await service.processDue();
    await service.idle();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Drafting decisions: reading a leased job',
    );
  });
});
