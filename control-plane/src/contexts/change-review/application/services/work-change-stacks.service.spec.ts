import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import { RedraftChangeStack } from '@change-review/application/services/redraft-change-stack.service';
import { WorkChangeStacks } from '@change-review/application/services/work-change-stacks.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import {
  JOB_LEASE_MS,
  MAX_JOB_ATTEMPTS,
} from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-17T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const changed = (path: string, at: number): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.at(at + 1),
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      patch: '@@ -1 +1 @@\n-before\n+after',
    },
  ],
});

const layered = (layers: string[][]): ProposedCohort[] => [
  {
    kind: 'change',
    title: 'Invitations',
    intent: 'Invite people',
    joinedBecause: 'The table and the endpoint are one feature',
    layers: layers.map((hunks, at) => ({
      title: `Layer ${at + 1}`,
      summary: `Layer ${at + 1}`,
      dependsOn: [],
      hunks: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
      notes: hunks.map((hunk) => ({
        path: hunk === 'h1' ? 'schema.ts' : 'api.ts',
        note: 'Why it changes',
      })),
    })),
  },
];

const generating = () =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    replay: false,
    isSearch: false,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    base: null,
    diff: Diff.of(['schema.ts', 'api.ts'].map(changed)),
    facts: StackFacts.of({
      hunks: ['h1', 'h2'].map((hunk, at) => ({
        hunk: HunkId.of(hunk),
        path: at === 0 ? 'schema.ts' : 'api.ts',
        fileClass: 'source',
        incidental: false,
        renamed: false,
        moved: false,
        linkable: true,
        defines: [],
        outside: [],
      })),
      links: [],
      imports: [],
    }),
    request: CheckRequest.of('npm test', null),
    now: NOW,
  });

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const working = (
  initial: ChangeStack,
  answer: () => Promise<readonly ProposedCohort[]>,
  available = true,
) => {
  let stored = initial;
  let now = NOW;
  const generate = vi.fn(answer);

  const stacks = {
    find: async () => stored,
    save: async (stack: ChangeStack) => {
      stored = stack;
    },
    nextDueJob: async (at: Date) =>
      stored.hasPendingJob && stored.job.isDue(at) ? stored : null,
  } as unknown as ChangeStackRepository;
  const generator: ChangeStackGeneratorPort = {
    available,
    generate: async () => ({ cohorts: await generate(), usage: null }),
  };
  const clock = { now: () => now, sleep: async () => undefined };

  const checks = {
    find: async () => null,
    save: async () => undefined,
  } as unknown as StackCheckRepository;

  const service = new WorkChangeStacks(
    stacks,
    checks,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    new GenerateChangeStack(
      stacks,
      generator,
      {} as never,
      {} as never,
      {} as never,
      { generate: () => 'stack-1' },
      clock,
      QUIET,
    ),
    new RedraftChangeStack(generator, clock, QUIET),
    clock,
    QUIET,
    { report: () => undefined },
  );

  const tick = async (at: Date) => {
    now = at;
    await service.processDue();
    await service.idle();
  };

  return { tick, generate, stored: () => stored };
};

describe('WorkChangeStacks', () => {
  it('still fails a stack left generating as not generated once the model to generate it is gone', async () => {
    const worked = working(
      generating(),
      async () => {
        throw new Error('No OpenRouter API key is set for change stacks');
      },
      false,
    );

    for (let day = 0; day < MAX_JOB_ATTEMPTS; day += 1) {
      await worked.tick(new Date(NOW.getTime() + day * DAY));
    }

    expect(worked.generate).toHaveBeenCalledTimes(MAX_JOB_ATTEMPTS);
    expect(worked.stored().state).toBe('failed');
  });

  it('generates a stack that is generating, leasing it while it does', async () => {
    let leasedWhileGenerating = false;
    const worked = working(generating(), async () => {
      leasedWhileGenerating = !worked.stored().job.isDue(NOW);
      return layered([['h1'], ['h2']]);
    });

    await worked.tick(NOW);

    expect(leasedWhileGenerating).toBe(true);
    expect(worked.stored().state).toBe('ready');
    expect(worked.stored().hasPendingJob).toBe(false);
  });

  it('retries a failed generation later rather than at once, then dead-letters it', async () => {
    const worked = working(generating(), async () => {
      throw new Error('overloaded');
    });

    await worked.tick(NOW);
    await worked.tick(NOW);

    expect(worked.generate).toHaveBeenCalledTimes(1);
    expect(worked.stored().state).toBe('generating');

    for (let day = 1; day < MAX_JOB_ATTEMPTS; day += 1) {
      await worked.tick(new Date(NOW.getTime() + day * DAY));
    }

    expect(worked.generate).toHaveBeenCalledTimes(MAX_JOB_ATTEMPTS);
    expect(worked.stored().state).toBe('failed');
  });

  it('takes up a generation a restart interrupted once its lease runs out', async () => {
    const worked = working(generating().leaseJob(NOW), async () =>
      layered([['h1', 'h2']]),
    );

    await worked.tick(new Date(NOW.getTime() + 60_000));
    expect(worked.generate).not.toHaveBeenCalled();

    await worked.tick(new Date(NOW.getTime() + JOB_LEASE_MS + 1));
    expect(worked.stored().state).toBe('ready');
  });

  it('dead-letters a job interrupted every time without requesting it again', async () => {
    let interrupted = generating();
    for (let day = 0; day < MAX_JOB_ATTEMPTS; day += 1) {
      interrupted = interrupted.leaseJob(new Date(NOW.getTime() + day * DAY));
    }
    const worked = working(interrupted, async () => layered([['h1', 'h2']]));

    await worked.tick(new Date(NOW.getTime() + MAX_JOB_ATTEMPTS * DAY));

    expect(worked.generate).not.toHaveBeenCalled();
    expect(worked.stored().state).toBe('failed');
  });

  it('stops redrafting a stack whose check has gone', async () => {
    const redrafting = generating()
      .propose(layered([['h1'], ['h2']]), NOW)
      .requestRedraft();
    const worked = working(redrafting, async () => layered([['h2'], ['h1']]));

    await worked.tick(NOW);

    expect(worked.stored().redrafting).toBe(false);
    expect(worked.stored().hasPendingJob).toBe(false);
  });
});
