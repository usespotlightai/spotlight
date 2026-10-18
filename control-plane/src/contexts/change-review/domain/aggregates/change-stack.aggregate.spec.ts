import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { NoStackForSearchesError } from '@change-review/domain/exceptions/no-stack-for-searches.error';
import type { HunkLink } from '@change-review/domain/services/diff-facts';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackProgress } from '@change-review/domain/value-objects/stack-progress.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import {
  JOB_BACKOFF_MS,
  JOB_LEASE_MS,
  MAX_JOB_ATTEMPTS,
} from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, path: string, line: string): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.of(id),
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      patch: `@@ -1 +1 @@\n-before\n+${line}`,
    },
  ],
});

const DIFF = Diff.of([
  hunk('h1', 'schema.ts', 'invitation table'),
  hunk('h2', 'invite.api.ts', 'POST /invitations'),
  hunk('h3', 'Invite.tsx', 'invite form'),
]);

const NOW = new Date('2026-09-16T10:00:00Z');

const generating = (
  facts = StackFacts.none(),
  replay = false,
  isSearch = false,
) =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    replay,
    isSearch,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: ' web ',
    base: null,
    diff: DIFF,
    facts,
    request: null,
    now: NOW,
  });

const layer = (
  title: string,
  hunks: string[],
  dependsOn: ProposedLayer['dependsOn'] = [],
): ProposedLayer => ({
  title,
  summary: `${title}, in more words`,
  dependsOn,
  hunks: hunks.map((each) => ({ hunk: HunkId.of(each) })),
  notes: [
    ...new Set(hunks.flatMap((each) => DIFF.fileOf(each)?.path ?? [])),
  ].map((path) => ({ path, note: 'Why it changes' })),
});

const invitations = (layers: ProposedLayer[]): ProposedCohort => ({
  kind: 'change',
  title: 'Team invitations',
  intent: 'Let admins invite people to a team',
  layers,
});

const LATER = new Date(NOW.getTime() + 60_000);

const problemsOf = (cohorts: ProposedCohort[]): readonly string[] => {
  try {
    generating().propose(cohorts, LATER);
  } catch (error) {
    if (error instanceof InvalidChangeStackError) {
      return error.problems.map((each) => each.message);
    }
    throw error;
  }
  return [];
};

describe('ChangeStack', () => {
  describe('of a replay', () => {
    const kindsOf = (stack: ChangeStack) =>
      stack.pullEvents().map((each) => each.kind);

    it('stays in Spotlight: it says it completed for its replay, and shapes no task’s outcome', () => {
      const stack = generating(StackFacts.none(), true);
      stack.pullEvents();

      const ready = stack.propose(
        [invitations([layer('Everything', ['h1', 'h2', 'h3'])])],
        LATER,
      );

      expect(ready.postsToGitHub).toBe(false);
      expect(kindsOf(ready)).toEqual([
        'change-stack.completed',
        'change-stack.replay-completed',
      ]);
    });

    it('says it completed for its replay when it could not be generated', () => {
      const stack = generating(StackFacts.none(), true);
      stack.pullEvents();

      expect(kindsOf(stack.fail('No.', LATER))).toEqual([
        'change-stack.failed',
        'change-stack.replay-completed',
      ]);
    });

    it('is never generated for a search run, which changes no repository', () => {
      expect(() => generating(StackFacts.none(), false, true)).toThrow(
        NoStackForSearchesError,
      );
    });

    it('belongs to no task', () => {
      expect(() =>
        ChangeStack.startGeneration({
          id: ChangeStackId.of('stack-1'),
          runId: RunId.of('run-1'),
          taskId: TaskId.of('task-1'),
          replay: true,
          isSearch: false,
          workspaceId: WorkspaceId.of('workspace-1'),
          repository: 'web',
          base: null,
          diff: DIFF,
          facts: StackFacts.none(),
          request: null,
          now: NOW,
        }),
      ).toThrow(InconsistentStateError);
    });

    it('is told apart from a task run’s stack, which posts to GitHub and shapes its task’s outcome', () => {
      const stack = generating();
      stack.pullEvents();

      const ready = stack.propose(
        [invitations([layer('Everything', ['h1', 'h2', 'h3'])])],
        LATER,
      );

      expect(ready.postsToGitHub).toBe(true);
      expect(kindsOf(ready)).toEqual([
        'change-stack.completed',
        'change-stack.ready',
      ]);
    });
  });

  it('starts generating, with nothing completed', () => {
    const stack = generating();

    expect(stack.state).toBe('generating');
    expect(stack.pullEvents().map((each) => each.kind)).toEqual([
      'change-stack.generation-started',
    ]);
    expect(stack.repository?.value).toBe('web');
    expect(stack.cohorts).toEqual([]);
    expect(stack.completedAt).toBeNull();
  });

  it('becomes ready with a stack that assigns every hunk once, in order', () => {
    const ready = generating().propose(
      [
        invitations([
          layer('Data model', ['h1']),
          layer('API', ['h2'], [{ layer: 1, because: ['invitation'] }]),
          layer('UI', ['h3'], [{ layer: 2, because: [' createInvitation '] }]),
        ]),
      ],
      LATER,
    );

    expect(ready.state).toBe('ready');
    expect(ready.completedAt).toEqual(LATER);
    expect(ready.cohorts[0]?.id).toBe('c1');
    expect(ready.cohorts[0]?.layers.map((each) => each.id)).toEqual([
      'c1.l1',
      'c1.l2',
      'c1.l3',
    ]);
    expect(ready.cohorts[0]?.layers[2]?.dependsOn).toEqual([
      { layer: 'c1.l2', because: ['createInvitation'] },
    ]);
  });

  it('rejects a stack that leaves a hunk out or assigns one twice', () => {
    expect(
      problemsOf([
        invitations([layer('Data model', ['h1', 'h1']), layer('API', ['h2'])]),
      ]),
    ).toEqual(['assigns h1 2 times', 'leaves h3 out']);
  });

  it('rejects a change the diff does not contain', () => {
    expect(
      problemsOf([
        invitations([layer('Everything', ['h1', 'h2', 'h3', 'h9'])]),
      ]),
    ).toEqual(['cohort 1, layer 1 names h9, which is not in the diff']);
  });

  it('rejects a layer that depends on itself or on a later layer', () => {
    expect(
      problemsOf([
        invitations([
          layer('Data model', ['h1'], [{ layer: 2, because: ['api'] }]),
          layer('API', ['h2', 'h3'], [{ layer: 2, because: ['api'] }]),
        ]),
      ]),
    ).toEqual([
      'cohort 1, layer 1 depends on layer 2, but a layer only depends on an earlier layer of its own cohort',
      'cohort 1, layer 2 depends on layer 2, but a layer only depends on an earlier layer of its own cohort',
    ]);
  });

  it('rejects a dependency that does not say what it uses', () => {
    expect(
      problemsOf([
        invitations([
          layer('Data model', ['h1']),
          layer('Rest', ['h2', 'h3'], [{ layer: 1, because: [' '] }]),
        ]),
      ]),
    ).toEqual([
      'cohort 1, layer 2 depends on layer 1 without naming what it uses from it',
    ]);
  });

  it('rejects a stack with an empty cohort or no cohorts at all', () => {
    expect(problemsOf([])).toContain('has no cohorts');
    expect(problemsOf([invitations([])])).toContain('cohort 1 has no layers');
  });

  it('fails with the reason it receives, and says so', () => {
    const generated = generating();
    generated.pullEvents();

    const failed = generated.fail('The model returned no answer', LATER);

    expect(failed.state).toBe('failed');
    expect(failed.failure).toBe('The model returned no answer');
    expect(failed.pullEvents().map((each) => each.kind)).toEqual([
      'change-stack.failed',
    ]);
  });

  it('completes only once', () => {
    const failed = generating().fail('No', LATER);

    expect(() => failed.fail('Again', LATER)).toThrow(InvalidChangeStackError);
  });

  it('is leased to one worker at a time while it is generated', () => {
    const leased = generating().leaseJob(NOW);

    expect(leased.hasPendingJob).toBe(true);
    expect(leased.job.attempts).toBe(1);
    expect(leased.job.isDue(LATER)).toBe(false);
    expect(() => leased.leaseJob(LATER)).toThrow(InvalidChangeStackError);
    expect(leased.job.isDue(new Date(NOW.getTime() + JOB_LEASE_MS + 1))).toBe(
      true,
    );
  });

  it('is retried later, waiting longer each time, then dead-lettered', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const at = (day: number) => new Date(NOW.getTime() + day * DAY);

    const once = generating().leaseJob(at(0)).scheduleRetry(at(0));
    const twice = once.leaseJob(at(1)).scheduleRetry(at(1));

    expect(once.state).toBe('generating');
    expect(once.job.nextAttemptAt).toEqual(
      new Date(at(0).getTime() + JOB_BACKOFF_MS),
    );
    expect(twice.job.nextAttemptAt).toEqual(
      new Date(at(1).getTime() + JOB_BACKOFF_MS * 2),
    );

    let exhausted = generating();
    for (let day = 0; day < MAX_JOB_ATTEMPTS; day += 1) {
      exhausted = exhausted.leaseJob(at(day)).scheduleRetry(at(day));
    }

    expect(exhausted.state).toBe('failed');
    expect(exhausted.failure).toBe(
      'Spotlight couldn’t generate the change stack.',
    );
    expect(exhausted.hasPendingJob).toBe(false);
  });

  it('has no pending job once it completes', () => {
    const ready = generating()
      .leaseJob(NOW)
      .propose([invitations([layer('Everything', ['h1', 'h2', 'h3'])])], LATER);

    expect(ready.hasPendingJob).toBe(false);
    expect(ready.job.attempts).toBe(0);
    expect(ready.scheduleRetry(LATER)).toBe(ready);
    expect(() => ready.leaseJob(LATER)).toThrow(InvalidChangeStackError);
  });
});

describe('ChangeStack with facts from the code', () => {
  const USES = [
    {
      kind: 'uses' as const,
      from: HunkId.of('h2'),
      to: HunkId.of('h1'),
      because: ['Invitation'],
    },
  ];
  const factsWith = (links: HunkLink[]) =>
    StackFacts.of({ hunks: [], links, imports: [] });

  it('rejects a stack that separates a hunk from what it uses, or puts it first', () => {
    const apart = (): string[] => {
      try {
        generating(factsWith(USES)).propose(
          [
            invitations([layer('API', ['h2', 'h3'])]),
            invitations([layer('Model', ['h1'])]),
          ],
          LATER,
        );
      } catch (error) {
        return (error as InvalidChangeStackError).problems.map(
          (each) => each.message,
        );
      }
      return [];
    };

    const early = (): string[] => {
      try {
        generating(factsWith(USES)).propose(
          [invitations([layer('API', ['h2', 'h3']), layer('Model', ['h1'])])],
          LATER,
        );
      } catch (error) {
        return (error as InvalidChangeStackError).problems.map(
          (each) => each.message,
        );
      }
      return [];
    };

    expect(apart()).toEqual([
      'h2 uses Invitation from h1, so they belong in the same cohort',
    ]);
    expect(early()).toEqual([
      'h2 uses Invitation from h1, so it cannot come in an earlier layer than h1',
    ]);
  });

  it('works out what a layer depends on from the facts, alongside what was proposed', () => {
    const ready = generating(
      factsWith([
        ...USES,
        {
          kind: 'uses',
          from: HunkId.of('h3'),
          to: HunkId.of('h2'),
          because: ['POST /invitations'],
        },
        {
          kind: 'uses',
          from: HunkId.of('h3'),
          to: HunkId.of('h1'),
          because: ['Invitation'],
        },
      ]),
    ).propose(
      [
        invitations([
          layer('Model', ['h1']),
          layer('API', ['h2'], [{ layer: 1, because: ['createInvitation'] }]),
          layer('UI', ['h3']),
        ]),
      ],
      LATER,
    );

    const [, api, ui] = ready.cohorts[0]?.layers ?? [];

    expect(api?.dependsOn).toEqual([
      { layer: 'c1.l1', because: ['createInvitation', 'Invitation'] },
    ]);
    expect(ui?.dependsOn).toEqual([
      { layer: 'c1.l1', because: ['Invitation'] },
      { layer: 'c1.l2', because: ['POST /invitations'] },
    ]);
  });
});

describe('ChangeStack read back from what was stored', () => {
  const ready = () =>
    generating().propose(
      [
        invitations([
          layer('Model', ['h1']),
          layer('API', ['h2']),
          layer('UI', ['h3']),
        ]),
      ],
      LATER,
    );

  const stored = (over: Partial<Parameters<typeof ChangeStack.rehydrate>[0]>) =>
    ChangeStack.rehydrate({
      id: ChangeStackId.of('stack-1'),
      runId: RunId.of('run-1'),
      taskId: null,
      replay: false,
      workspaceId: WorkspaceId.of('workspace-1'),
      repository: RepositoryName.of('web'),
      base: null,
      diff: DIFF,
      facts: StackFacts.none(),
      cohorts: ready().cohorts,
      progress: ready().progress,
      job: ready().job,
      usage: ModelUsage.none(),
      request: ready().request,
      redrafting: false,
      version: 1,
      ...over,
    });

  it('takes a stack back as it was left', () => {
    expect(stored({}).state).toBe('ready');
  });

  it('rejects a ready stack that leaves a hunk out, or assigns one twice', () => {
    const [cohort] = ready().cohorts;
    const withoutUI = [{ ...cohort, layers: cohort?.layers.slice(0, 2) }];

    expect(() => stored({ cohorts: withoutUI })).toThrow(
      InconsistentStateError,
    );
    expect(() => stored({ cohorts: withoutUI })).toThrow('leaves h3 out');

    const twice = [
      {
        ...cohort,
        layers: [...(cohort?.layers ?? []), cohort?.layers[0]],
      },
    ];

    expect(() => stored({ cohorts: twice })).toThrow('assigns h1 2 times');
  });

  it('rejects a stack that is ready with nothing assigned, or failed without saying why', () => {
    expect(() => stored({ cohorts: [] })).toThrow(
      'is ready, yet assigns nothing',
    );

    expect(() =>
      stored({
        cohorts: [],
        progress: StackProgress.rehydrate({
          state: 'failed',
          failure: null,
          startedAt: NOW,
          completedAt: LATER,
        }),
      }),
    ).toThrow('failed without saying why');
  });

  it('rejects a stack that is still generating, yet has cohorts', () => {
    expect(() =>
      stored({
        progress: StackProgress.generating(NOW),
      }),
    ).toThrow('is still generating, yet already has cohorts');
  });
});
