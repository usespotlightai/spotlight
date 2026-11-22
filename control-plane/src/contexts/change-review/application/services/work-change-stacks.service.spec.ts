import type {
  ChangeStackGenerationRequest,
  ChangeStackGeneratorPort,
  GeneratedChangeStack,
} from '@change-review/application/ports/change-stack-generator.port';
import {
  SESSION_WAITING,
  type SessionWaiting,
} from '@change-review/application/ports/session-waiting';
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
import { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import {
  JOB_LEASE_MS,
  MAX_JOB_ATTEMPTS,
} from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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
      questions: [],
    })),
  },
];

const generating = () =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of('stack-1'),
    origin: StackOrigin.run(RunId.of('run-1')),
    taskId: null,
    teamOfRun: TeamId.of('team_1'),
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('workspace-1'),
    owner: 'acme',
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

const drafting = (
  cohorts: readonly ProposedCohort[],
): Promise<GeneratedChangeStack> =>
  Promise.resolve({ status: 'drafted', cohorts, usage: null });

const working = (
  initial: ChangeStack,
  answer: (
    request: ChangeStackGenerationRequest,
  ) => Promise<GeneratedChangeStack | SessionWaiting>,
) => {
  let stored = initial;
  let now = NOW;
  const generate = vi.fn(answer);

  const stacks = {
    find: async () => stored,
    ofTask: async () => [stored],
    save: async (stack: ChangeStack) => {
      stored = stack;
    },
    nextDueJob: async (at: Date) =>
      stored.hasPendingJob && stored.job.isDue(at) ? stored : null,
  } as unknown as ChangeStackRepository;
  const generator: ChangeStackGeneratorPort = { generate };
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
      { stackingFor: <T>(_: unknown, work: () => Promise<T>) => work() },
      { generate: () => 'stack-1' },
      clock,
      QUIET,
    ),
    new RedraftChangeStack(stacks, generator, clock, QUIET),
    clock,
    QUIET,
    { report: () => undefined },
    telemetryInMemory(),
  );

  const tick = async (at: Date) => {
    now = at;
    await service.processDue();
    await service.idle();
  };

  return { tick, generate, stored: () => stored };
};

describe('WorkChangeStacks', () => {
  it('fails a stack as not generated at once when no harness can draft it, or its run is in another workspace', async () => {
    for (const reason of ['no-harness', 'base-run-elsewhere'] as const) {
      const worked = working(generating(), async () => ({
        status: 'failed',
        failure: SessionFailure.of(reason),
      }));

      await worked.tick(NOW);

      expect(worked.generate).toHaveBeenCalledTimes(1);
      expect(worked.stored().state).toBe('failed');
      expect(worked.stored().failure).toBe('not-generated');
    }
  });

  it('generates a stack that is generating, leasing it while it does', async () => {
    let leasedWhileGenerating = false;
    const worked = working(generating(), async () => {
      leasedWhileGenerating = !worked.stored().job.isDue(NOW);
      return drafting(layered([['h1'], ['h2']]));
    });

    await worked.tick(NOW);

    expect(leasedWhileGenerating).toBe(true);
    expect(worked.stored().state).toBe('ready');
    expect(worked.stored().hasPendingJob).toBe(false);
  });

  it('drafts the stack in a session based on the run that made it', async () => {
    const worked = working(generating(), () =>
      drafting(layered([['h1'], ['h2']])),
    );

    await worked.tick(NOW);

    expect(worked.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        round: DraftingRound.draft(ChangeStackId.of('stack-1'), 1),
        basedOnRun: RunId.of('run-1'),
        problems: [],
      }),
    );
  });

  it('retries a session that gave no stack later, in a new round, then dead-letters it', async () => {
    const worked = working(generating(), async () => ({
      status: 'failed',
      failure: SessionFailure.of('run-failed'),
    }));

    await worked.tick(NOW);
    await worked.tick(NOW);

    expect(worked.generate).toHaveBeenCalledTimes(1);
    expect(worked.stored().state).toBe('generating');

    for (let day = 1; day < MAX_JOB_ATTEMPTS; day += 1) {
      await worked.tick(new Date(NOW.getTime() + day * DAY));
    }

    expect(
      worked.generate.mock.calls.map(([request]) => request.round.attempt),
    ).toEqual([1, 2, 3, 4]);
    expect(worked.stored().state).toBe('failed');
    expect(worked.stored().failure).toBe('not-generated');
  });

  it('waits for its session in the same round, however long it runs, without spending attempts', async () => {
    let waits = MAX_JOB_ATTEMPTS + 2;
    const worked = working(generating(), async () => {
      if (waits > 0) {
        waits -= 1;
        return SESSION_WAITING;
      }
      return drafting(layered([['h1'], ['h2']]));
    });

    for (let at = 0; at <= MAX_JOB_ATTEMPTS + 2; at += 1) {
      await worked.tick(new Date(NOW.getTime() + at * 60_000));
    }

    expect(
      new Set(
        worked.generate.mock.calls.map(([request]) => request.round.attempt),
      ),
    ).toEqual(new Set([1]));
    expect(worked.stored().state).toBe('ready');
  });

  it('drafts again with the problems of a stack that broke its rules, then settles it', async () => {
    const worked = working(generating(), (request) =>
      drafting(
        request.problems.length === 0
          ? layered([['h1']])
          : layered([['h1'], ['h2']]),
      ),
    );

    await worked.tick(NOW);

    expect(worked.stored().state).toBe('generating');
    expect(worked.stored().problems.map((each) => each.message)).toEqual([
      'leaves h2 out',
    ]);

    await worked.tick(new Date(NOW.getTime() + DAY));

    const [, again] = worked.generate.mock.calls.map(([request]) => request);
    expect(again?.round.attempt).toBe(2);
    expect(again?.problems.map((each) => each.message)).toEqual([
      'leaves h2 out',
    ]);
    expect(worked.stored().state).toBe('ready');
    expect(worked.stored().problems).toEqual([]);
  });

  it('stops a stack that keeps breaking its rules as broke-rules', async () => {
    const worked = working(generating(), () => drafting(layered([['h1']])));

    for (let day = 0; day < MAX_JOB_ATTEMPTS; day += 1) {
      await worked.tick(new Date(NOW.getTime() + day * DAY));
    }

    expect(worked.generate).toHaveBeenCalledTimes(MAX_JOB_ATTEMPTS);
    expect(worked.stored().failure).toBe('broke-rules');
  });

  it('takes up a generation a restart interrupted once its lease runs out', async () => {
    const worked = working(generating().leaseJob(NOW), () =>
      drafting(layered([['h1', 'h2']])),
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
    const worked = working(interrupted, () =>
      drafting(layered([['h1', 'h2']])),
    );

    await worked.tick(new Date(NOW.getTime() + MAX_JOB_ATTEMPTS * DAY));

    expect(worked.generate).not.toHaveBeenCalled();
    expect(worked.stored().state).toBe('failed');
  });

  it('stops redrafting a stack whose check has gone', async () => {
    const redrafting = generating()
      .propose(layered([['h1'], ['h2']]), NOW)
      .requestRedraft();
    const worked = working(redrafting, () =>
      drafting(layered([['h2'], ['h1']])),
    );

    await worked.tick(NOW);

    expect(worked.stored().redrafting).toBe(false);
    expect(worked.stored().hasPendingJob).toBe(false);
  });
});
