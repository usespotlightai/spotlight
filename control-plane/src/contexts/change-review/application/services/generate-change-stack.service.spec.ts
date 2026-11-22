import type {
  ChangeStackGenerationRequest,
  ChangeStackGeneratorPort,
  GeneratedChangeStack,
} from '@change-review/application/ports/change-stack-generator.port';
import type {
  DiffReaderPort,
  DiffSource,
} from '@change-review/application/ports/diff-reader.port';
import { SESSION_WAITING } from '@change-review/application/ports/session-waiting';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import { RedraftChangeStack } from '@change-review/application/services/redraft-change-stack.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import { NoStackWithoutCheckoutsError } from '@change-review/domain/exceptions/no-stack-without-checkouts.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { CodeReading } from '@change-review/domain/services/code-reading';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { RepositoryStack } from '@change-review/domain/value-objects/repository-stack.vo';
import { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import { WHOLE_STEP } from '@change-review/domain/value-objects/stack-check.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import {
  NO_INDEX,
  type SymbolIndex,
} from '@change-review/domain/value-objects/symbol-index.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { MAX_JOB_ATTEMPTS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const changed = (path: string, removed: string[], added: string[]) => ({
  path,
  removed,
  added,
});

type Changed = ReturnType<typeof changed>;

const texts = new Map<string, readonly Changed[]>();

const written = (...files: Changed[]): string => {
  const text = files.map((file) => file.path).join('+');
  texts.set(text, files);
  return text;
};

const fileOf = (file: Changed, at: number): DiffFile => ({
  path: file.path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.at(at + 1),
      oldStart: 1,
      oldLines: file.removed.length,
      newStart: 1,
      newLines: file.added.length,
      patch: [
        `@@ -1,${file.removed.length} +1,${file.added.length} @@`,
        ...file.removed.map((line) => `-${line}`),
        ...file.added.map((line) => `+${line}`),
      ].join('\n'),
    },
  ],
});

const READER: DiffReaderPort = {
  read: (text) => {
    const files = texts.get(text);

    if (!files) {
      throw new InvalidDiffError('has no changes');
    }

    return {
      diff: Diff.of(files.map(fileOf)),
      sources: files.flatMap((file): DiffSource[] => [
        { path: file.path, side: 'before', text: file.removed.join('\n') },
        { path: file.path, side: 'after', text: file.added.join('\n') },
      ]),
    };
  },
};

const READING: CodeReading = {
  classOf: (path) => (path === 'package-lock.json' ? 'lockfile' : 'source'),
  reads: (path) => path.endsWith('.ts'),
  definitionsIn: (_, added) =>
    added.flatMap((line) => /function\s+(\w+)/.exec(line)?.slice(1) ?? []),
  importsIn: () => [],
};

const DIFF = written(
  changed('schema.ts', ['before'], ['invitation table']),
  changed('api.ts', ['before'], ['POST /invitations']),
);

const RUN = {
  origin: StackOrigin.run(RunId.of('run-1')),
  taskId: null,
  teamOfRun: TeamId.of('team_1'),
  trial: false,
  checkouts: 1,
  workspaceId: WorkspaceId.of('workspace-1'),
};

const cohort = (
  hunks: string[],
  paths: string[] = ['schema.ts', 'api.ts'],
): ProposedCohort => ({
  kind: 'change',
  title: 'Team invitations',
  intent: 'Let admins invite people',
  joinedBecause: 'The table and endpoint are one feature',
  layers: [
    {
      title: 'Add invitations',
      summary: 'The table and the endpoint',
      dependsOn: [],
      hunks: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
      notes: hunks.map((hunk) => ({
        path: paths[Number(hunk.slice(1)) - 1] ?? hunk,
        note: 'Why it changes',
      })),
      questions: [],
    },
  ],
});

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

type Undrafted = Extract<GeneratedChangeStack, { status: 'failed' }>;

type Answer = readonly ProposedCohort[] | Undrafted | 'pending';

const generating = (
  over: {
    answers?: Answer[];
    index?: SymbolIndexerPort['index'];
    logger?: LoggerPort;
    ids?: () => string;
  } = {},
) => {
  const saved: ChangeStack[] = [];
  const dispatched: DomainEvent[] = [];
  const steps: string[] = [];
  let transacting = false;
  const requests: ChangeStackGenerationRequest[] = [];
  const answers = [...(over.answers ?? [[cohort(['h1', 'h2'])]])];
  const usage = {
    inputTokens: 1_000,
    outputTokens: 200,
    cost: { amount: 0.01, currency: 'USD' as const },
  };

  const stacks: ChangeStackRepository = {
    add: async (stack) => {
      steps.push(transacting ? 'add in transaction' : 'add');
      saved.push(stack);
      dispatched.push(...stack.pullEvents());
    },
    save: async (stack) => {
      saved.push(stack);
      dispatched.push(...stack.pullEvents());
    },
    find: async (id) =>
      [...saved].reverse().find((each) => each.id.equals(id)) ?? null,
    nextDueJob: async () => null,
    ofRun: async () => [],
    ofTask: async (taskId) => {
      if (transacting) {
        steps.push(`read ${taskId.value} in transaction`);
      }

      return [
        ...new Map(
          saved
            .filter((each) => each.taskId?.equals(taskId))
            .map((each) => [each.id.value, each]),
        ).values(),
      ];
    },
    ofTeam: async () => [],
    remove: async () => undefined,
  };

  const generator: ChangeStackGeneratorPort = {
    generate: async (request) => {
      requests.push(request);
      const answer = answers.shift();

      if (!answer) {
        throw new Error('Requested too often');
      }
      if (answer === 'pending') {
        return SESSION_WAITING;
      }
      return 'failure' in answer
        ? answer
        : { status: 'drafted', cohorts: answer, usage };
    },
  };

  const service = new GenerateChangeStack(
    stacks,
    generator,
    READER,
    READING,
    { index: over.index ?? (async () => NO_INDEX) },
    {
      stackingFor: async <T>(
        taskId: TaskId,
        work: () => Promise<T>,
      ): Promise<T> => {
        transacting = true;
        steps.push(`lock ${taskId.value} in transaction`);
        try {
          return await work();
        } finally {
          transacting = false;
        }
      },
    },
    { generate: over.ids ?? (() => 'stack-1') },
    {
      now: () => new Date('2026-09-16T10:00:00Z'),
      sleep: async () => undefined,
    },
    over.logger ?? QUIET,
  );

  const generated = async (
    input: Parameters<GenerateChangeStack['begin']>[1],
  ): Promise<ChangeStack> => {
    const stack = await service.begin(RUN, input);
    await stacks.save(await service.generated(stack));
    return stack;
  };

  return {
    service,
    saved,
    steps,
    requests,
    stacks,
    generator,
    dispatched,
    generated,
  };
};

describe('GenerateChangeStack', () => {
  it('generates no stack for a run without checkouts, storing nothing and calling no model', async () => {
    const { service, saved, requests } = generating();

    await expect(
      service.begin(
        { ...RUN, checkouts: 0 },
        {
          diff: DIFF,
          owner: 'acme',
          repository: 'web',
          base: null,
          request: null,
        },
      ),
    ).rejects.toThrow(NoStackWithoutCheckoutsError);
    expect(saved).toEqual([]);
    expect(requests).toEqual([]);
  });

  it('stores the stack, then completes it as ready once the generator assigns every hunk', async () => {
    const { service, saved, dispatched, requests, stacks } = generating();

    const stack = await service.begin(RUN, {
      diff: DIFF,
      owner: 'acme',
      repository: 'web',
      base: null,
      request: null,
    });

    expect(stack.state).toBe('generating');
    expect(stack.diff.hunks).toHaveLength(2);
    expect(requests).toEqual([]);
    expect(dispatched).toEqual([]);

    await service.generated(stack).then((ready) => stacks.save(ready));

    expect(saved.map((each) => each.state)).toEqual(['generating', 'ready']);
    expect(dispatched.map((each) => each.kind)).toEqual([
      'change-stack.completed',
      'change-stack.became-ready',
    ]);
    expect(saved[1]?.cohorts[0]?.layers[0]?.hunks).toHaveLength(2);
  });

  it('drafts the whole stack in one session based on the run that made the diff, keeping its usage', async () => {
    const { generated, saved, requests } = generating();

    await generated({
      diff: DIFF,
      owner: 'acme',
      repository: 'web',
      base: null,
      request: null,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      workspaceId: 'workspace-1',
      round: DraftingRound.draft(ChangeStackId.of('stack-1'), 0),
      basedOnRun: RunId.of('run-1'),
      repository: { value: 'web' },
      problems: [],
      previous: null,
    });
    expect(saved[saved.length - 1]?.usage).toMatchObject({
      calls: 1,
      inputTokens: 1_000,
      costs: [{ amount: 0.01, currency: 'USD' }],
    });
  });

  it('drafts again later with what was wrong, where the stack broke the rules', async () => {
    const { service, requests } = generating({
      answers: [[cohort(['h1'])], [cohort(['h1', 'h2'])]],
    });
    const stack = await service.begin(RUN, {
      diff: DIFF,
      owner: 'acme',
      repository: null,
      base: null,
      request: null,
    });

    const broken = await service.generated(stack);

    expect(broken.state).toBe('generating');
    expect(broken.problems.map((each) => each.message)).toEqual([
      'leaves h2 out',
    ]);
    expect(broken.job.isDue(new Date('2026-09-16T10:00:00Z'))).toBe(false);

    const ready = await service.generated(broken);

    expect(
      requests.map((each) => each.problems.map((problem) => problem.message)),
    ).toEqual([[], ['leaves h2 out']]);
    expect(ready.state).toBe('ready');
    expect(ready.usage).toMatchObject({
      calls: 2,
      inputTokens: 2_000,
      costs: [{ amount: 0.02, currency: 'USD' }],
    });
  });

  it('fails the generation where the stack still breaks the rules on its last attempt', async () => {
    const { service } = generating({ answers: [[cohort(['h1'])]] });
    let stack = await service.begin(RUN, {
      diff: DIFF,
      owner: 'acme',
      repository: null,
      base: null,
      request: null,
    });
    for (let at = 0; at < MAX_JOB_ATTEMPTS; at += 1) {
      stack = stack.leaseJob(new Date(Date.UTC(2026, 8, 17 + at)));
    }

    const failed = await service.generated(stack);

    expect(failed.state).toBe('failed');
    expect(failed.failure).toBe('broke-rules');
    expect(failed.usage.calls).toBe(1);
  });

  it('leaves the generation to be retried where the session gives no stack', async () => {
    for (const failure of ['run-failed', 'no-result'] as const) {
      const { service } = generating({
        answers: [{ status: 'failed', failure: SessionFailure.of(failure) }],
      });
      const stack = await service.begin(RUN, {
        diff: DIFF,
        owner: 'acme',
        repository: null,
        base: null,
        request: null,
      });

      const left = await service.generated(stack);

      expect(left.state).toBe('generating');
      expect(left.usage.calls).toBe(0);
    }
  });

  it('fails a stack as not generated at once where no harness can run its session', async () => {
    const { service } = generating({
      answers: [{ status: 'failed', failure: SessionFailure.of('no-harness') }],
    });
    const stack = await service.begin(RUN, {
      diff: DIFF,
      owner: 'acme',
      repository: null,
      base: null,
      request: null,
    });

    const left = await service.generated(stack);

    expect(left.state).toBe('failed');
    expect(left.failure).toBe('not-generated');
    expect(left.hasPendingJob).toBe(false);
  });

  it('lets the job loop wait while the session drafts the stack', async () => {
    const { service } = generating({ answers: ['pending'] });
    const stack = await service.begin(RUN, {
      diff: DIFF,
      owner: 'acme',
      repository: null,
      base: null,
      request: null,
    });

    const waiting = await service.generated(stack);

    expect(waiting.hasPendingJob).toBe(true);
    expect(waiting.job.waitingSince).not.toBeNull();
  });

  it('rejects text that is not a diff, storing nothing', async () => {
    const { service, saved } = generating();

    await expect(
      service.begin(RUN, {
        diff: 'nothing changed',
        owner: 'acme',
        repository: null,
        base: null,
        request: null,
      }),
    ).rejects.toThrow(InvalidDiffError);
    expect(saved).toEqual([]);
  });

  describe('with facts from the code', () => {
    const LOCKFILE = changed(
      'package-lock.json',
      ['"zod": "4.4.2"'],
      ['"zod": "4.4.3"'],
    );
    const LINKED = written(
      changed('src/invite.ts', [], ['export function createInvitation() {}']),
      changed(
        'src/routes.ts',
        [],
        ['router.post("/invitations", createInvitation);'],
      ),
      LOCKFILE,
    );

    const LINKED_PATHS = ['src/invite.ts', 'src/routes.ts'];
    const apart: ProposedCohort[] = [
      cohort(['h2'], LINKED_PATHS),
      cohort(['h1'], LINKED_PATHS),
    ];

    it('hands the generator the facts, and arranges incidental hunks itself', async () => {
      const { generated, saved, requests } = generating({
        answers: [[cohort(['h1', 'h2'], LINKED_PATHS)]],
      });

      await generated({
        diff: LINKED,
        owner: 'acme',
        repository: null,
        base: null,
        request: null,
      });

      expect(requests[0]?.facts.links).toEqual([
        {
          kind: 'uses',
          from: HunkId.of('h2'),
          to: HunkId.of('h1'),
          because: ['createInvitation'],
        },
      ]);

      const ready = saved[saved.length - 1];
      expect(ready?.state).toBe('ready');
      expect(ready?.cohorts.map((each) => each.kind)).toEqual([
        'change',
        'incidental',
      ]);
      expect(
        ready?.cohorts[1]?.layers[0]?.hunks.map((each) => each.hunk),
      ).toEqual(['h3']);
    });

    it('drafts again where the stack splits what the code ties together, rather than store it', async () => {
      const { service } = generating({ answers: [apart] });
      const stack = await service.begin(RUN, {
        diff: LINKED,
        owner: 'acme',
        repository: null,
        base: null,
        request: null,
      });

      const broken = await service.generated(stack);

      expect(broken.problems).toEqual([
        {
          code: 'uses',
          message:
            'h2 uses createInvitation from h1, so they belong in the same cohort',
        },
      ]);
      expect(broken.state).toBe('generating');
    });

    it('links what the parsed code ties together, beyond what the diff lines show', async () => {
      const read: string[] = [];
      const index: SymbolIndex = {
        files: [
          {
            path: 'api.ts',
            side: 'after',
            scope: ['api.ts'],
            symbols: [],
            imports: [
              {
                local: 'table',
                imported: 'invitations',
                specifier: './schema',
                resolved: ['schema.ts'],
                project: true,
              },
            ],
            references: [{ name: 'table', line: 1, through: null }],
            routeUses: [],
          },
          {
            path: 'schema.ts',
            side: 'after',
            scope: ['schema.ts'],
            symbols: [
              {
                name: 'invitations',
                kind: 'constant',
                line: 1,
                endLine: 1,
                exportedAs: ['invitations'],
              },
            ],
            imports: [],
            references: [],
            routeUses: [],
          },
        ],
      };
      const { generated, requests } = generating({
        index: async (sources) => {
          read.push(...sources.map((each) => `${each.side}:${each.path}`));
          return index;
        },
      });

      await generated({
        diff: DIFF,
        owner: 'acme',
        repository: null,
        base: null,
        request: null,
      });

      expect(read).toEqual([
        'before:schema.ts',
        'after:schema.ts',
        'before:api.ts',
        'after:api.ts',
      ]);
      expect(requests[0]?.facts.links).toEqual([
        {
          kind: 'uses',
          from: HunkId.of('h2'),
          to: HunkId.of('h1'),
          because: ['invitations'],
        },
      ]);
    });

    it('generates from the diff alone where the code cannot be parsed', async () => {
      const { generated, saved, requests } = generating({
        answers: [[cohort(['h1', 'h2'], LINKED_PATHS)]],
        index: async () => {
          throw new Error('no grammar');
        },
      });

      await generated({
        diff: LINKED,
        owner: 'acme',
        repository: null,
        base: null,
        request: null,
      });

      expect(requests[0]?.facts.links).toHaveLength(1);
      expect(saved[saved.length - 1]?.state).toBe('ready');
    });

    it('generates a diff of nothing but incidental changes without a session', async () => {
      const lockfileOnly = written(LOCKFILE);
      const { generated, saved, requests } = generating({ answers: [] });

      await generated({
        diff: lockfileOnly,
        owner: 'acme',
        repository: null,
        base: null,
        request: null,
      });

      expect(requests).toEqual([]);
      expect(saved[saved.length - 1]?.cohorts[0]?.kind).toBe('incidental');
    });
  });
});

describe('RedraftChangeStack', () => {
  const twoLayers: ProposedCohort = {
    ...cohort(['h1']),
    layers: [
      {
        title: 'Add the table',
        summary: 'The table',
        dependsOn: [],
        hunks: [{ hunk: HunkId.of('h1') }],
        notes: [{ path: 'schema.ts', note: 'Adds the table' }],
        questions: [],
      },
      {
        title: 'Add the endpoint',
        summary: 'The endpoint',
        dependsOn: [],
        hunks: [{ hunk: HunkId.of('h2') }],
        notes: [{ path: 'api.ts', note: 'Adds the endpoint' }],
        questions: [],
      },
    ],
  };

  const failedCheck = async (answers: Answer[]) => {
    const generated = generating({ answers: [[twoLayers], ...answers] });
    await generated.generated({
      diff: DIFF,
      owner: 'acme',
      repository: null,
      base: null,
      request: CheckRequest.of('npx tsc --noEmit', null),
    });

    const ready = generated.saved[generated.saved.length - 1];
    const check = StackCheck.begin({
      stackId: ready.id,
      runId: ready.runId,
      taskId: null,
      teamId: TeamId.of('team_1'),
      trial: false,
      workspaceId: ready.workspaceId,
      request: CheckRequest.of('npx tsc --noEmit', null),
      stack: RepositoryStack.of({
        repository: null,
        startedAt: new Date('2026-09-16T10:00:00Z'),
      }),
      entries: ready.entries(),
      now: new Date('2026-09-16T10:00:00Z'),
    })
      .claimedFor(
        RunnerId.of('checker_1'),
        RunnerOffer.none(),
        new Date('2026-09-16T10:00:00Z'),
      )
      .recordResult(
        RunnerId.of('checker_1'),
        { steps: ready.checkSteps(ready.entries()), layers: ready.layers() },
        [
          { step: WHOLE_STEP, passed: true, output: '', durationMs: 1 },
          {
            step: LayerId.of('c1.l1'),
            passed: false,
            output: 'api.ts(1,1): error TS2304',
            durationMs: 1,
          },
        ],
        new Date('2026-09-16T10:00:00Z'),
      );
    const redrafting = ready.requestRedraft();

    generated.saved.push(redrafting);

    const service = new RedraftChangeStack(
      generated.stacks,
      generated.generator,
      {
        now: () => new Date('2026-09-16T10:05:00Z'),
        sleep: async () => undefined,
      },
      QUIET,
    );

    return { ...generated, redrafting, check, service };
  };

  it('requests the layers again with what the check found, and takes the redrafted stack', async () => {
    const [table, endpoint] = twoLayers.layers;
    const moved: ProposedCohort = {
      ...twoLayers,
      layers: [endpoint, table].flatMap((layer) => (layer ? [layer] : [])),
    };
    const { service, saved, requests, redrafting, check } = await failedCheck([
      [moved],
    ]);

    saved.push(await service.redrafted(redrafting, check));

    expect(requests[1]?.problems).toEqual([]);
    expect(
      requests[1]?.redraft?.failed.map((each) => [each.cohort, each.layer]),
    ).toEqual([[0, 0]]);

    const redrafted = saved[saved.length - 1];
    expect(
      redrafted?.cohorts[0]?.layers.map((layer) =>
        layer.hunks.map((entry) => entry.hunk),
      ),
    ).toEqual([['h2'], ['h1']]);
    expect(redrafted?.redrafting).toBe(false);
  });

  it('redrafts in a session of its own, based on the run that made the stack', async () => {
    const { service, requests, redrafting, check } = await failedCheck([
      'pending',
    ]);

    const waiting = await service.redrafted(redrafting, check);

    expect(waiting.job.waitingSince).not.toBeNull();
    expect(requests[1]).toMatchObject({
      round: DraftingRound.redraft(check.id, 0),
      basedOnRun: RunId.of('run-1'),
    });
  });

  it('redrafts again with the problems of a redraft that broke the rules, and keeps the checked layers once its attempts run out', async () => {
    const { service, redrafting, check } = await failedCheck([
      [cohort(['h1'])],
      [cohort(['h2'])],
    ]);

    const broken = await service.redrafted(redrafting, check);

    expect(broken.redrafting).toBe(true);
    expect(broken.problems.map((each) => each.message)).toEqual([
      'leaves h2 out',
      'joins layers, leaving 1 where there were 2',
    ]);

    let exhausted = broken;
    for (let at = 0; at < MAX_JOB_ATTEMPTS; at += 1) {
      exhausted = exhausted.leaseJob(new Date(Date.UTC(2026, 8, 17 + at)));
    }
    const kept = await service.redrafted(exhausted, check);

    expect(kept.redrafting).toBe(false);
    expect(kept.cohorts[0]?.layers).toHaveLength(2);
  });

  it('leaves the redrafting to be retried where the session gives no stack', async () => {
    const { service, redrafting, check } = await failedCheck([
      { status: 'failed', failure: SessionFailure.of('run-failed') },
    ]);

    const left = await service.redrafted(redrafting, check);

    expect(left.redrafting).toBe(true);
  });

  it('keeps the checked layers where no harness can run the redraft', async () => {
    const { service, redrafting, check } = await failedCheck([
      { status: 'failed', failure: SessionFailure.of('no-harness') },
    ]);

    const left = await service.redrafted(redrafting, check);

    expect(left.redrafting).toBe(false);
    expect(left.hasPendingJob).toBe(false);
    expect(left.cohorts[0]?.layers).toHaveLength(2);
  });
});

describe('for a task that had a stack before', () => {
  const TASK_RUN = {
    ...RUN,
    taskId: TaskId.of('task-1'),
    teamOfRun: null,
  };
  const CHANGED = written(
    changed('schema.ts', ['before'], ['invitation table']),
    changed('api.ts', ['before'], ['POST /invitations, 409 for members']),
    changed('docs.ts', [], ['How to invite']),
  );
  const CHANGED_PATHS = ['schema.ts', 'api.ts', 'docs.ts'];
  const counted = () => {
    let made = 0;
    return () => {
      made += 1;
      return `stack-${made}`;
    };
  };
  const twice = async (second: string, answers: Answer[]) => {
    const generation = generating({ ids: counted(), answers });
    const input = {
      owner: 'acme',
      repository: 'web',
      base: null,
      request: null,
    };

    const first = await generation.service.begin(TASK_RUN, {
      ...input,
      diff: DIFF,
    });
    await generation.stacks.save(await generation.service.generated(first));
    const next = await generation.service.begin(TASK_RUN, {
      ...input,
      diff: second,
    });
    const done = await generation.service.generated(next);

    return { ...generation, next, done };
  };

  it('keeps nothing while it prepares a stack, and starts it after the task stacks it is given', async () => {
    const generation = generating({
      ids: counted(),
      answers: [[cohort(['h1', 'h2'])]],
    });
    const input = {
      owner: 'acme',
      repository: 'web',
      base: null,
      request: null,
    };
    const first = await generation.service.generated(
      await generation.service.begin(TASK_RUN, { ...input, diff: DIFF }),
    );
    await generation.stacks.save(first);

    const prepared = await generation.service.prepare(TASK_RUN, {
      ...input,
      diff: DIFF,
    });

    expect(
      (await generation.stacks.ofTask(TaskId.of('task-1'))).map(
        (each) => each.id.value,
      ),
    ).toEqual([first.id.value]);

    const started = await generation.service.start(prepared, [first]);

    expect(started.id.equals(prepared.id)).toBe(true);
    expect(started.previous?.equals(first.id)).toBe(true);
    expect(
      (await generation.stacks.ofTask(TaskId.of('task-1'))).map(
        (each) => each.id.value,
      ),
    ).toEqual([first.id.value, started.id.value]);
  });

  it('locks the task stacks in one transaction before it reads them and starts a stack', async () => {
    const generation = generating({ answers: [[cohort(['h1', 'h2'])]] });

    await generation.service.begin(TASK_RUN, {
      diff: DIFF,
      owner: 'acme',
      repository: 'web',
      base: null,
      request: null,
    });

    expect(generation.steps).toEqual([
      'lock task-1 in transaction',
      'read task-1 in transaction',
      'add in transaction',
    ]);
  });

  it('starts a stack of no task without a lock', async () => {
    const generation = generating({ answers: [[cohort(['h1', 'h2'])]] });

    await generation.service.begin(RUN, {
      diff: DIFF,
      owner: 'acme',
      repository: 'web',
      base: null,
      request: null,
    });

    expect(generation.steps).toEqual(['add']);
  });

  it('starts a prepared stack after none when it is given no task stacks', async () => {
    const generation = generating({
      ids: counted(),
      answers: [[cohort(['h1', 'h2'])]],
    });
    const input = {
      owner: 'acme',
      repository: 'web',
      base: null,
      request: null,
    };
    await generation.stacks.save(
      await generation.service.generated(
        await generation.service.begin(TASK_RUN, { ...input, diff: DIFF }),
      ),
    );

    const started = await generation.service.start(
      await generation.service.prepare(TASK_RUN, { ...input, diff: DIFF }),
      [],
    );

    expect(started.previous).toBeNull();
  });

  it('reuses the earlier stack without a session when the diff is the same', async () => {
    const { next, done, requests } = await twice(DIFF, [
      [cohort(['h1', 'h2'])],
    ]);

    expect(next.previous?.value).toBe('stack-1');
    expect(requests).toHaveLength(1);
    expect(done.state).toBe('ready');
    expect(done.cohorts[0]?.layers[0]?.revision).toEqual({
      status: 'unchanged',
      previous: 'c1.l1',
    });
  });

  it('tells the session what the earlier stack kept and which hunks changed', async () => {
    const { done, requests } = await twice(CHANGED, [
      [cohort(['h1', 'h2'])],
      [cohort(['h1', 'h2', 'h3'], CHANGED_PATHS)],
    ]);

    expect(requests[1]?.previous).toMatchObject({
      stackId: { value: 'stack-1' },
      addedHunks: ['h2', 'h3'],
      diffUnchanged: false,
    });
    expect(done.cohorts[0]?.layers[0]?.revision).toEqual({
      status: 'modified',
      previous: 'c1.l1',
    });
  });

  it('follows no earlier stack for a team’s run', async () => {
    const team = generating({ ids: counted() });
    const input = {
      diff: DIFF,
      owner: 'acme',
      repository: 'web',
      base: null,
      request: null,
    };

    await team.stacks.save(
      await team.service.generated(await team.service.begin(RUN, input)),
    );
    const stack = await team.service.begin(RUN, input);

    expect(stack.previous).toBeNull();
  });

  describe('pushed to the pull request', () => {
    const PUSHED = {
      ...TASK_RUN,
      origin: StackOrigin.push(
        CommitSha.parsed('b'.repeat(40)) as CommitSha,
        Pusher.of('octocat'),
      ),
    };

    it('drafts in a session based on the newest run of the task', async () => {
      const generation = generating({
        ids: counted(),
        answers: [
          [cohort(['h1', 'h2'])],
          [cohort(['h1', 'h2', 'h3'], CHANGED_PATHS)],
        ],
      });
      const input = {
        owner: 'acme',
        repository: 'web',
        base: null,
        request: null,
      };
      await generation.stacks.save(
        await generation.service.generated(
          await generation.service.begin(TASK_RUN, { ...input, diff: DIFF }),
        ),
      );

      const pushed = await generation.service.generated(
        await generation.service.begin(PUSHED, { ...input, diff: CHANGED }),
      );

      expect(generation.requests[1]?.basedOnRun).toEqual(RunId.of('run-1'));
      expect(pushed.state).toBe('ready');
    });

    it('is not generated where the task has no run to base the session on', async () => {
      const generation = generating();

      const pushed = await generation.service.generated(
        await generation.service.begin(PUSHED, {
          diff: DIFF,
          owner: 'acme',
          repository: 'web',
          base: null,
          request: null,
        }),
      );

      expect(generation.requests).toEqual([]);
      expect(pushed.state).toBe('failed');
      expect(pushed.failure).toBe('not-generated');
    });
  });
});
