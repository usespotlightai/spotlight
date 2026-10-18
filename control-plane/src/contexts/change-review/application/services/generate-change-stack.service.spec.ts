import { GenerationError } from '@change-review/application/errors/generation.error';
import type {
  ChangeStackGenerationRequest,
  ChangeStackGeneratorPort,
} from '@change-review/application/ports/change-stack-generator.port';
import type { CodeReadingPort } from '@change-review/application/ports/code-reading.port';
import type {
  DiffReaderPort,
  DiffSource,
} from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import { RedraftChangeStack } from '@change-review/application/services/redraft-change-stack.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { ChangeStacksUnavailableError } from '@change-review/domain/exceptions/change-stacks-unavailable.error';
import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import { NoStackForSearchesError } from '@change-review/domain/exceptions/no-stack-for-searches.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import {
  NO_INDEX,
  type SymbolIndex,
} from '@change-review/domain/services/symbol-index';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import { WHOLE_STEP } from '@change-review/domain/value-objects/stack-check.vo';
import type { ProposedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
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

const READING: CodeReadingPort = {
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
  id: RunId.of('run-1'),
  taskId: null,
  isReplay: false,
  isSearch: false,
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
    },
  ],
});

const QUIET: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const generating = (
  over: {
    available?: boolean;
    answers?: (readonly ProposedCohort[] | Error)[];
    index?: SymbolIndexerPort['index'];
  } = {},
) => {
  const saved: ChangeStack[] = [];
  const dispatched: DomainEvent[] = [];
  const requests: ChangeStackGenerationRequest[] = [];
  const answers = [...(over.answers ?? [[cohort(['h1', 'h2'])]])];

  const stacks: ChangeStackRepository = {
    add: async (stack) => {
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
    removeForTask: async () => undefined,
    ofRun: async () => [],
  };

  const generator: ChangeStackGeneratorPort = {
    available: over.available ?? true,
    generate: async (request) => {
      requests.push(request);
      const answer = answers.shift();

      if (!answer || answer instanceof Error) {
        throw answer ?? new Error('Requested too often');
      }
      return {
        cohorts: answer,
        usage: {
          inputTokens: 1_000,
          outputTokens: 200,
          cost: { amount: 0.01, currency: 'USD' },
        },
      };
    },
  };

  const service = new GenerateChangeStack(
    stacks,
    generator,
    READER,
    READING,
    { index: over.index ?? (async () => NO_INDEX) },
    { generate: () => 'stack-1' },
    {
      now: () => new Date('2026-09-16T10:00:00Z'),
      sleep: async () => undefined,
    },
    QUIET,
  );

  const generated = async (
    input: Parameters<GenerateChangeStack['begin']>[1],
  ): Promise<ChangeStack> => {
    const stack = await service.begin(RUN, input);
    await stacks.save(await service.generated(stack));
    return stack;
  };

  return { service, saved, requests, stacks, generator, dispatched, generated };
};

describe('GenerateChangeStack', () => {
  it('generates no stack for a search run, storing nothing and calling no model', async () => {
    const { service, saved, requests } = generating();

    await expect(
      service.begin(
        { ...RUN, isSearch: true },
        { diff: DIFF, repository: 'web', base: null, request: null },
      ),
    ).rejects.toThrow(NoStackForSearchesError);
    expect(saved).toEqual([]);
    expect(requests).toEqual([]);
  });

  it('stores the stack, then completes it as ready once the generator assigns every hunk', async () => {
    const { service, saved, dispatched, requests, stacks } = generating();

    const stack = await service.begin(RUN, {
      diff: DIFF,
      repository: 'web',
      base: null,
      request: null,
    });

    expect(stack.state).toBe('generating');
    expect(stack.diff.hunks).toHaveLength(2);
    expect(requests).toEqual([]);
    expect(dispatched.map((each) => each.kind)).toEqual([
      'change-stack.generation-started',
    ]);

    await service.generated(stack).then((ready) => stacks.save(ready));

    expect(saved.map((each) => each.state)).toEqual(['generating', 'ready']);
    expect(dispatched.map((each) => each.kind)).toEqual([
      'change-stack.generation-started',
      'change-stack.completed',
      'change-stack.ready',
    ]);
    expect(saved[1]?.cohorts[0]?.layers[0]?.hunks).toHaveLength(2);
  });

  it('requests again with what was wrong, where the first stack broke the rules', async () => {
    const { generated, saved, requests } = generating({
      answers: [[cohort(['h1'])], [cohort(['h1', 'h2'])]],
    });

    await generated({
      diff: DIFF,
      repository: null,
      base: null,
      request: null,
    });

    expect(
      requests.map((each) => each.problems.map((problem) => problem.message)),
    ).toEqual([[], ['leaves h2 out']]);
    expect(saved[saved.length - 1]?.state).toBe('ready');
    expect(saved[saved.length - 1]?.usage).toMatchObject({
      calls: 2,
      inputTokens: 2_000,
      costs: [{ amount: 0.02, currency: 'USD' }],
    });
  });

  it('fails the generation where the stack keeps breaking the rules', async () => {
    const { generated, saved } = generating({
      answers: [[cohort(['h1'])], [cohort(['h2'])]],
    });

    await generated({
      diff: DIFF,
      repository: null,
      base: null,
      request: null,
    });

    expect(saved[saved.length - 1]?.state).toBe('failed');
    expect(saved[saved.length - 1]?.failure).toBe(
      'The generated stack did not assign every hunk in order.',
    );
    expect(saved[saved.length - 1]?.usage.calls).toBe(2);
  });

  it('leaves the generation to be retried where the generator cannot answer', async () => {
    const { service } = generating({ answers: [new Error('overloaded')] });
    const stack = await service.begin(RUN, {
      diff: DIFF,
      repository: null,
      base: null,
      request: null,
    });

    const left = await service.generated(stack);

    expect(left.state).toBe('generating');
    expect(left.usage.calls).toBe(0);
  });

  it('records the usage of every attempt when a later one fails, an unreadable answer included', async () => {
    const { service } = generating({
      answers: [
        [cohort(['h1'])],
        new GenerationError('length', {
          inputTokens: 1_000,
          outputTokens: 4_000,
          cost: { amount: 0.05, currency: 'USD' },
        }),
      ],
    });
    const stack = await service.begin(RUN, {
      diff: DIFF,
      repository: null,
      base: null,
      request: null,
    });

    const left = await service.generated(stack);

    expect(left.state).toBe('generating');
    expect(left.usage).toMatchObject({
      calls: 2,
      outputTokens: 4_200,
      costs: [{ amount: 0.06, currency: 'USD' }],
    });
  });

  it('fails where this deployment cannot generate stacks', async () => {
    const { service } = generating({ available: false });

    await expect(
      service.begin(RUN, {
        diff: DIFF,
        repository: null,
        base: null,
        request: null,
      }),
    ).rejects.toThrow(ChangeStacksUnavailableError);
  });

  it('rejects text that is not a diff, storing nothing', async () => {
    const { service, saved } = generating();

    await expect(
      service.begin(RUN, {
        diff: 'nothing changed',
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

    it('requests again where the stack splits what the code ties together, then gives up rather than store it', async () => {
      const { generated, saved, requests } = generating({
        answers: [apart, apart],
      });

      await generated({
        diff: LINKED,
        repository: null,
        base: null,
        request: null,
      });

      expect(requests[1]?.problems).toEqual([
        {
          code: 'uses',
          message:
            'h2 uses createInvitation from h1, so they belong in the same cohort',
        },
      ]);
      expect(saved[saved.length - 1]?.state).toBe('failed');
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
        repository: null,
        base: null,
        request: null,
      });

      expect(requests[0]?.facts.links).toHaveLength(1);
      expect(saved[saved.length - 1]?.state).toBe('ready');
    });

    it('generates a diff of nothing but incidental changes without calling the model', async () => {
      const lockfileOnly = written(LOCKFILE);
      const { generated, saved, requests } = generating({ answers: [] });

      await generated({
        diff: lockfileOnly,
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
      },
      {
        title: 'Add the endpoint',
        summary: 'The endpoint',
        dependsOn: [],
        hunks: [{ hunk: HunkId.of('h2') }],
        notes: [{ path: 'api.ts', note: 'Adds the endpoint' }],
      },
    ],
  };

  const failedCheck = async (
    answers: (readonly ProposedCohort[] | Error)[],
  ) => {
    const generated = generating({ answers: [[twoLayers], ...answers] });
    await generated.generated({
      diff: DIFF,
      repository: null,
      base: null,
      request: CheckRequest.of('npx tsc --noEmit', null),
    });

    const ready = generated.saved[generated.saved.length - 1] as ChangeStack;
    const check = StackCheck.begin({
      stackId: ready.id,
      runId: ready.runId,
      taskId: null,
      replay: false,
      workspaceId: ready.workspaceId,
      request: CheckRequest.of('npx tsc --noEmit', null),
      entries: ready.entries(),
      now: new Date('2026-09-16T10:00:00Z'),
    })
      .claimedFor(
        RunnerId.of('checker_1'),
        RunnerTerms.none(),
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

  it('retains the checked layers where the redrafted stack keeps breaking the rules', async () => {
    const { service, redrafting, check } = await failedCheck([
      [cohort(['h1'])],
      [cohort(['h2'])],
    ]);

    const redrafted = await service.redrafted(redrafting, check);

    expect(redrafted.redrafting).toBe(false);
    expect(redrafted.cohorts[0]?.layers).toHaveLength(2);
  });

  it('leaves the redrafting to be retried where the model cannot answer', async () => {
    const { service, redrafting, check } = await failedCheck([
      new Error('overloaded'),
    ]);

    const left = await service.redrafted(redrafting, check);

    expect(left.redrafting).toBe(true);
  });
});
