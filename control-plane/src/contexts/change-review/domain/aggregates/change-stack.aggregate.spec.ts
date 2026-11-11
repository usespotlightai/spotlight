import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { NoStackOwnerError } from '@change-review/domain/exceptions/no-stack-owner.error';
import { NoStackWithoutCheckoutsError } from '@change-review/domain/exceptions/no-stack-without-checkouts.error';
import { UnknownQuestionError } from '@change-review/domain/exceptions/unknown-question.error';
import type { HunkLink } from '@change-review/domain/services/diff-facts';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  DraftedCohort,
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  HunkId,
  LayerId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
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
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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
  facts = StackFacts.of({ hunks: [], links: [], imports: [] }),
  trial = false,
  checkouts = 1,
) =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    teamOfRun: TeamId.of('team_1'),
    trial,
    checkouts,
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
    ...new Set(
      hunks.flatMap((each) => DIFF.fileOf(HunkId.of(each))?.path ?? []),
    ),
  ].map((path) => ({ path, note: 'Why it changes' })),
  questions: [],
});

const invitations = (layers: ProposedLayer[]): ProposedCohort => ({
  kind: 'change',
  title: 'Team invitations',
  intent: 'Let admins invite people to a team',
  layers,
});

const LATER = new Date(NOW.getTime() + 60_000);

const problemsOf = (cohorts: DraftedCohort[]): readonly string[] => {
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
  it('is never generated for a run without checkouts, which changes no repository', () => {
    expect(() =>
      generating(
        StackFacts.of({ hunks: [], links: [], imports: [] }),
        false,
        0,
      ),
    ).toThrow(NoStackWithoutCheckoutsError);
  });

  describe('of a trial', () => {
    const kindsOf = (stack: ChangeStack) =>
      stack.pullEvents().map((each) => each.kind);

    it('stays in Spotlight: it says it completed for its trial, and shapes no task’s outcome', () => {
      const stack = generating(
        StackFacts.of({ hunks: [], links: [], imports: [] }),
        true,
      );
      stack.pullEvents();

      const ready = stack.propose(
        [invitations([layer('Everything', ['h1', 'h2', 'h3'])])],
        LATER,
      );

      expect(kindsOf(ready)).toEqual([
        'change-stack.completed',
        'change-stack.trial-settled',
      ]);
    });

    it('says it completed for its trial when it could not be generated', () => {
      const stack = generating(
        StackFacts.of({ hunks: [], links: [], imports: [] }),
        true,
      );
      stack.pullEvents();

      expect(kindsOf(stack.deadLetter(LATER))).toEqual([
        'change-stack.trial-settled',
      ]);
    });

    it('belongs to no task', () => {
      expect(() =>
        ChangeStack.startGeneration({
          id: ChangeStackId.of('stack-1'),
          runId: RunId.of('run-1'),
          taskId: TaskId.of('task-1'),
          teamOfRun: TeamId.of('team_1'),
          trial: true,
          checkouts: 1,
          workspaceId: WorkspaceId.of('workspace-1'),
          repository: 'web',
          base: null,
          diff: DIFF,
          facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
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

      expect(kindsOf(ready)).toEqual([
        'change-stack.completed',
        'change-stack.became-ready',
      ]);
    });
  });

  describe('owner', () => {
    const owned = (taskId: TaskId | null, teamOfRun: TeamId | null) =>
      ChangeStack.startGeneration({
        id: ChangeStackId.of('stack-1'),
        runId: RunId.of('run-1'),
        taskId,
        teamOfRun,
        trial: false,
        checkouts: 1,
        workspaceId: WorkspaceId.of('workspace-1'),
        repository: 'web',
        base: null,
        diff: DIFF,
        facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
        request: null,
        now: NOW,
      });

    it('belongs to its task, or without a task to the team of its run', () => {
      const ofTask = owned(TaskId.of('task-1'), TeamId.of('team_1'));
      const ofTeam = owned(null, TeamId.of('team_1'));

      expect([ofTask.taskId?.value, ofTask.teamId]).toEqual(['task-1', null]);
      expect([ofTeam.taskId, ofTeam.teamId?.value]).toEqual([null, 'team_1']);
    });

    it('is refused without a task or a team, since nobody could review it', () => {
      expect(() => owned(null, null)).toThrow(NoStackOwnerError);
    });
  });

  it('starts generating, with nothing completed', () => {
    const stack = generating();

    expect(stack.state).toBe('generating');
    expect(stack.pullEvents()).toEqual([]);
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

  it('rejects a stack that places a hunk the diff does not have, so the model can mend it', () => {
    expect(
      problemsOf([
        {
          ...invitations([layer('Everything', ['h1', 'h2', 'h3'])]),
          layers: [
            {
              ...layer('Everything', ['h1', 'h2', 'h3']),
              hunks: [{ hunk: 'h1' }, { hunk: 'h2' }, { hunk: 'hx' }],
            },
          ],
        },
      ]),
    ).toEqual(['cohort 1, layer 1 names hx, which is not in the diff']);
  });

  it('rejects a stack with an empty cohort or no cohorts at all', () => {
    expect(problemsOf([])).toContain('has no cohorts');
    expect(problemsOf([invitations([])])).toContain('cohort 1 has no layers');
  });

  it('fails with why it stopped, as a code', () => {
    const failed = generating().stopForBrokenRules(LATER);

    expect(failed.state).toBe('failed');
    expect(failed.failure).toBe('broke-rules');
    expect(failed.pullEvents()).toEqual([]);
  });

  it('completes only once', () => {
    const failed = generating().deadLetter(LATER);

    expect(() =>
      failed.propose(
        [invitations([layer('Everything', ['h1', 'h2', 'h3'])])],
        LATER,
      ),
    ).toThrow(InvalidChangeStackError);
  });

  it('renews the lease of a worker still generating it, without counting another attempt', () => {
    const renewed = generating().leaseJob(NOW).renewJobLease(LATER);

    expect(renewed.job.attempts).toBe(1);
    expect(renewed.job.isDue(new Date(NOW.getTime() + JOB_LEASE_MS + 1))).toBe(
      false,
    );
    expect(
      renewed.job.isDue(new Date(LATER.getTime() + JOB_LEASE_MS + 1)),
    ).toBe(true);
  });

  it('fails a stack whose answer was cut off, and retries one whose call failed', () => {
    const leased = generating().leaseJob(NOW);

    expect(leased.settleFailedCall({ truncated: true }, LATER).failure).toBe(
      'too-large',
    );
    expect(leased.settleFailedCall({ truncated: false }, LATER).state).toBe(
      'generating',
    );
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
    expect(exhausted.failure).toBe('not-generated');
    expect(exhausted.hasPendingJob).toBe(false);
  });

  it('needs a model only for hunks it does not set aside as incidental', () => {
    const facts = (incidental: boolean) =>
      StackFacts.of({
        hunks: DIFF.hunks.map((each) => ({
          hunk: each.id,
          path: DIFF.fileOf(each.id)?.path ?? '',
          fileClass: incidental ? 'lockfile' : 'source',
          incidental,
          renamed: false,
          moved: false,
          linkable: !incidental,
          defines: [],
          outside: [],
        })),
        links: [],
        imports: [],
      });

    expect(generating(facts(true)).needsModel).toBe(false);
    expect(generating(facts(false)).needsModel).toBe(true);
  });

  it('asks for no redraft without a check', () => {
    const ready = generating().propose(
      [invitations([layer('Everything', ['h1', 'h2', 'h3'])])],
      LATER,
    );

    expect(ready.requestRedraft().redraftFor(null)).toBeNull();
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

  describe('moved code', () => {
    const MOVES: HunkLink[] = [
      {
        kind: 'moves',
        from: HunkId.of('h3'),
        to: HunkId.of('h1'),
        because: ['schema.ts → Invite.tsx'],
      },
    ];

    it('puts moved code that a stack parts in one layer', () => {
      const ready = generating(factsWith(MOVES)).propose(
        [
          invitations([
            layer('Model', ['h1']),
            layer('API', ['h2']),
            layer('UI', ['h3']),
          ]),
        ],
        LATER,
      );

      expect(
        ready.cohorts[0]?.layers.map((each) =>
          each.hunks.map((entry) => entry.hunk),
        ),
      ).toEqual([['h2'], ['h3', 'h1']]);
    });

    it('names the problems of the proposal when the stack fails after putting moved code together', () => {
      const facts = factsWith([
        ...MOVES,
        {
          kind: 'uses',
          from: HunkId.of('h2'),
          to: HunkId.of('h1'),
          because: ['Invitation'],
        },
      ]);

      expect(() =>
        generating(facts).propose(
          [
            invitations([layer('Model', ['h1']), layer('UI', ['h3'])]),
            invitations([layer('API', ['h2'])]),
          ],
          LATER,
        ),
      ).toThrow(
        expect.objectContaining({
          problems: [
            expect.objectContaining({
              message:
                'h2 uses Invitation from h1, so they belong in the same cohort',
            }),
            expect.objectContaining({
              message:
                'h3 is code moved from h1, so they belong in the same layer',
            }),
          ],
        }),
      );
    });

    it('names the problems of the proposal when putting moved code together does not help', () => {
      const proposed = [
        invitations([
          layer('Model', ['h1']),
          { ...layer('API', ['h2']), title: '' },
          layer('UI', ['h3']),
        ]),
      ];

      expect(() =>
        generating(factsWith(MOVES)).propose(proposed, LATER),
      ).toThrow(
        expect.objectContaining({
          problems: [
            expect.objectContaining({
              message:
                'cohort 1, layer 2 needs a title of at most 120 characters',
            }),
            expect.objectContaining({
              message:
                'h3 is code moved from h1, so they belong in the same layer',
            }),
          ],
        }),
      );
    });
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
      teamId: TeamId.of('team_1'),
      trial: false,
      workspaceId: WorkspaceId.of('workspace-1'),
      repository: RepositoryName.of('web'),
      base: null,
      diff: DIFF,
      facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
      cohorts: ready().cohorts,
      progress: ready().progress,
      job: ready().job,
      usage: ModelUsage.none(),
      request: ready().request,
      redrafting: false,
      previous: null,
      removed: [],
      version: 1,
      ...over,
    });

  it('takes a stack back as it was left', () => {
    expect(stored({}).state).toBe('ready');
  });

  it('is refused when stored revised against no previous stack', () => {
    expect(() =>
      stored({
        removed: [
          { previous: LayerId.of('c1.l1'), cohort: 'Old', title: 'Gone' },
        ],
      }),
    ).toThrow(InconsistentStateError);
  });

  it('is refused when stored with both a task and a team', () => {
    expect(() =>
      stored({ taskId: TaskId.of('task-1'), teamId: TeamId.of('team_1') }),
    ).toThrow(InconsistentStateError);
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
    ).toThrow('has a failure that does not match its state');
  });

  it('rejects a stack that is still generating, yet has cohorts', () => {
    expect(() =>
      stored({
        progress: StackProgress.generating(NOW),
      }),
    ).toThrow('is still generating, yet already has cohorts');
  });

  describe('questions', () => {
    const asking = () =>
      generating().propose(
        [
          invitations([
            layer('Add the table', ['h1']),
            {
              ...layer('Add the API and the form', ['h2', 'h3']),
              questions: [
                {
                  question: 'What does the form send when the table is full?',
                  answer: 'Nothing; the API refuses it first.',
                  hunks: [HunkId.of('h1'), HunkId.of('h2')],
                },
              ],
            },
          ]),
        ],
        LATER,
      );

    it('finds a question it asks, with the hunks that show its answer', () => {
      const stack = asking();
      const question = stack.question(QuestionId.of('c1.l2.q1'));

      expect(question.answer).toBe('Nothing; the API refuses it first.');
      expect(stack.citedBy(question)).toEqual([
        { path: 'schema.ts', patch: '@@ -1 +1 @@\n-before\n+invitation table' },
        {
          path: 'invite.api.ts',
          patch: '@@ -1 +1 @@\n-before\n+POST /invitations',
        },
      ]);
    });

    it('asks nothing it did not generate, and nothing before it is ready', () => {
      expect(() => asking().question(QuestionId.of('c1.l1.q1'))).toThrow(
        UnknownQuestionError,
      );
      expect(() => generating().question(QuestionId.of('c1.l2.q1'))).toThrow(
        UnknownQuestionError,
      );
    });
  });
});
