import { DraftingError } from '@change-review/application/errors/drafting.error';
import type {
  ChangeStackDraft,
  ChangeStackDrafterPort,
} from '@change-review/application/ports/change-stack-drafter.port';
import type { CodeReadingPort } from '@change-review/application/ports/code-reading.port';
import type {
  DiffReaderPort,
  DiffSource,
} from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import { ReorderChangeStack } from '@change-review/application/services/reorder-change-stack.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { ChangeStacksUnavailableError } from '@change-review/domain/exceptions/change-stacks-unavailable.error';
import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
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
      throw new InvalidDiffError('holds no changes');
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
  replay: false,
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
      ranges: hunks.map((hunk) => ({ hunk: HunkId.of(hunk) })),
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

const drafting = (
  over: {
    available?: boolean;
    answers?: (readonly ProposedCohort[] | Error)[];
    index?: SymbolIndexerPort['index'];
  } = {},
) => {
  const saved: ChangeStack[] = [];
  const dispatched: DomainEvent[] = [];
  const asked: ChangeStackDraft[] = [];
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
    dueForWork: async () => null,
    removeForTask: async () => undefined,
    ofRun: async () => [],
  };

  const drafter: ChangeStackDrafterPort = {
    available: over.available ?? true,
    draft: async (draft) => {
      asked.push(draft);
      const answer = answers.shift();

      if (!answer || answer instanceof Error) {
        throw answer ?? new Error('Asked too often');
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

  const service = new DraftChangeStack(
    stacks,
    drafter,
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

  const drafted = async (
    input: Parameters<DraftChangeStack['begin']>[1],
  ): Promise<ChangeStack> => {
    const stack = await service.begin(RUN, input);
    await stacks.save(await service.drafted(stack));
    return stack;
  };

  return { service, saved, asked, stacks, drafter, dispatched, drafted };
};

describe('DraftChangeStack', () => {
  it('keeps the draft, then settles it ready once the drafter places every change', async () => {
    const { service, saved, dispatched, asked, stacks } = drafting();

    const stack = await service.begin(RUN, {
      diff: DIFF,
      repository: 'web',
      base: null,
      request: null,
    });

    expect(stack.state).toBe('drafting');
    expect(stack.diff.hunks).toHaveLength(2);
    expect(asked).toEqual([]);
    expect(dispatched.map((each) => each.kind)).toEqual([
      'change-stack.drafting-began',
    ]);

    await service.drafted(stack).then((ready) => stacks.save(ready));

    expect(saved.map((each) => each.state)).toEqual(['drafting', 'ready']);
    expect(dispatched.map((each) => each.kind)).toEqual([
      'change-stack.drafting-began',
      'change-stack.settled',
      'change-stack.shaped',
    ]);
    expect(saved[1]?.cohorts[0]?.layers[0]?.ranges).toHaveLength(2);
  });

  it('asks again with what was wrong, where the first stack broke the rules', async () => {
    const { drafted, saved, asked } = drafting({
      answers: [[cohort(['h1'])], [cohort(['h1', 'h2'])]],
    });

    await drafted({ diff: DIFF, repository: null, base: null, request: null });

    expect(
      asked.map((each) => each.problems.map((problem) => problem.message)),
    ).toEqual([[], ['leaves h2 out']]);
    expect(saved[saved.length - 1]?.state).toBe('ready');
    expect(saved[saved.length - 1]?.spent).toMatchObject({
      calls: 2,
      inputTokens: 2_000,
      costs: [{ amount: 0.02, currency: 'USD' }],
    });
  });

  it('fails the draft where the stack keeps breaking the rules', async () => {
    const { drafted, saved } = drafting({
      answers: [[cohort(['h1'])], [cohort(['h2'])]],
    });

    await drafted({ diff: DIFF, repository: null, base: null, request: null });

    expect(saved[saved.length - 1]?.state).toBe('failed');
    expect(saved[saved.length - 1]?.failure).toBe(
      'The drafted stack did not place every change in order.',
    );
    expect(saved[saved.length - 1]?.spent.calls).toBe(2);
  });

  it('leaves the draft to be tried again where the drafter cannot answer', async () => {
    const { service } = drafting({ answers: [new Error('overloaded')] });
    const stack = await service.begin(RUN, {
      diff: DIFF,
      repository: null,
      base: null,
      request: null,
    });

    const left = await service.drafted(stack);

    expect(left.state).toBe('drafting');
    expect(left.spent.calls).toBe(0);
  });

  it('keeps what every attempt spent when a later one fails, an unreadable answer included', async () => {
    const { service } = drafting({
      answers: [
        [cohort(['h1'])],
        new DraftingError('length', {
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

    const left = await service.drafted(stack);

    expect(left.state).toBe('drafting');
    expect(left.spent).toMatchObject({
      calls: 2,
      outputTokens: 4_200,
      costs: [{ amount: 0.06, currency: 'USD' }],
    });
  });

  it('refuses where this deployment cannot draft stacks', async () => {
    const { service } = drafting({ available: false });

    await expect(
      service.begin(RUN, {
        diff: DIFF,
        repository: null,
        base: null,
        request: null,
      }),
    ).rejects.toThrow(ChangeStacksUnavailableError);
  });

  it('refuses text that is not a diff, keeping nothing', async () => {
    const { service, saved } = drafting();

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

    it('hands the drafter the facts, and sets incidental changes aside itself', async () => {
      const { drafted, saved, asked } = drafting({
        answers: [[cohort(['h1', 'h2'], LINKED_PATHS)]],
      });

      await drafted({
        diff: LINKED,
        repository: null,
        base: null,
        request: null,
      });

      expect(asked[0]?.facts.links).toEqual([
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
        ready?.cohorts[1]?.layers[0]?.ranges.map((each) => each.hunk),
      ).toEqual(['h3']);
    });

    it('asks again where the stack splits what the code ties together, then gives up rather than keep it', async () => {
      const { drafted, saved, asked } = drafting({ answers: [apart, apart] });

      await drafted({
        diff: LINKED,
        repository: null,
        base: null,
        request: null,
      });

      expect(asked[1]?.problems).toEqual([
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
      const { drafted, asked } = drafting({
        index: async (sources) => {
          read.push(...sources.map((each) => `${each.side}:${each.path}`));
          return index;
        },
      });

      await drafted({
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
      expect(asked[0]?.facts.links).toEqual([
        {
          kind: 'uses',
          from: HunkId.of('h2'),
          to: HunkId.of('h1'),
          because: ['invitations'],
        },
      ]);
    });

    it('drafts from the diff alone where the code cannot be parsed', async () => {
      const { drafted, saved, asked } = drafting({
        answers: [[cohort(['h1', 'h2'], LINKED_PATHS)]],
        index: async () => {
          throw new Error('no grammar');
        },
      });

      await drafted({
        diff: LINKED,
        repository: null,
        base: null,
        request: null,
      });

      expect(asked[0]?.facts.links).toHaveLength(1);
      expect(saved[saved.length - 1]?.state).toBe('ready');
    });

    it('drafts a diff of nothing but incidental changes without asking the model', async () => {
      const lockfileOnly = written(LOCKFILE);
      const { drafted, saved, asked } = drafting({ answers: [] });

      await drafted({
        diff: lockfileOnly,
        repository: null,
        base: null,
        request: null,
      });

      expect(asked).toEqual([]);
      expect(saved[saved.length - 1]?.cohorts[0]?.kind).toBe('incidental');
    });
  });
});

describe('ReorderChangeStack', () => {
  const twoLayers: ProposedCohort = {
    ...cohort(['h1']),
    layers: [
      {
        title: 'Add the table',
        summary: 'The table',
        dependsOn: [],
        ranges: [{ hunk: HunkId.of('h1') }],
        notes: [{ path: 'schema.ts', note: 'Adds the table' }],
      },
      {
        title: 'Add the endpoint',
        summary: 'The endpoint',
        dependsOn: [],
        ranges: [{ hunk: HunkId.of('h2') }],
        notes: [{ path: 'api.ts', note: 'Adds the endpoint' }],
      },
    ],
  };

  const failedCheck = async (
    answers: (readonly ProposedCohort[] | Error)[],
  ) => {
    const drafted = drafting({ answers: [[twoLayers], ...answers] });
    await drafted.drafted({
      diff: DIFF,
      repository: null,
      base: null,
      request: CheckRequest.of('npx tsc --noEmit', null),
    });

    const ready = drafted.saved[drafted.saved.length - 1] as ChangeStack;
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
      .recorded(
        RunnerId.of('checker_1'),
        { steps: ready.checkSteps(ready.entries()), layers: ready.layers() },
        [
          { step: WHOLE_STEP, passed: true, output: '', tookMs: 1 },
          {
            step: LayerId.of('c1.l1'),
            passed: false,
            output: 'api.ts(1,1): error TS2304',
            tookMs: 1,
          },
        ],
        new Date('2026-09-16T10:00:00Z'),
      );
    const reordering = ready.askedToReorder();

    drafted.saved.push(reordering);

    const service = new ReorderChangeStack(
      drafted.drafter,
      {
        now: () => new Date('2026-09-16T10:05:00Z'),
        sleep: async () => undefined,
      },
      QUIET,
    );

    return { ...drafted, reordering, check, service };
  };

  it('asks for the layers again with what the check found, and takes the reordered stack', async () => {
    const [table, endpoint] = twoLayers.layers;
    const moved: ProposedCohort = {
      ...twoLayers,
      layers: [endpoint, table].flatMap((layer) => (layer ? [layer] : [])),
    };
    const { service, saved, asked, reordering, check } = await failedCheck([
      [moved],
    ]);

    saved.push(await service.reordered(reordering, check));

    expect(asked[1]?.problems).toEqual([]);
    expect(
      asked[1]?.reordering?.failed.map((each) => [each.cohort, each.layer]),
    ).toEqual([[0, 0]]);

    const reordered = saved[saved.length - 1];
    expect(
      reordered?.cohorts[0]?.layers.map((layer) =>
        layer.ranges.map((range) => range.hunk),
      ),
    ).toEqual([['h2'], ['h1']]);
    expect(reordered?.reordering).toBe(false);
  });

  it('keeps the checked layers where the reordered stack keeps breaking the rules', async () => {
    const { service, reordering, check } = await failedCheck([
      [cohort(['h1'])],
      [cohort(['h2'])],
    ]);

    const kept = await service.reordered(reordering, check);

    expect(kept.reordering).toBe(false);
    expect(kept.cohorts[0]?.layers).toHaveLength(2);
  });

  it('leaves the reordering to be tried again where the model cannot answer', async () => {
    const { service, reordering, check } = await failedCheck([
      new Error('overloaded'),
    ]);

    const left = await service.reordered(reordering, check);

    expect(left.reordering).toBe(true);
  });
});
