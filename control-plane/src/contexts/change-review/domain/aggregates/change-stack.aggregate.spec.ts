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
  MOST_WORK_ATTEMPTS,
  WORK_BACKOFF_MS,
  WORK_LEASE_MS,
} from '@shared-kernel/domain/value-objects/owed-work.vo';
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

const drafting = (
  facts = StackFacts.none(),
  replay = false,
  isSearch = false,
) =>
  ChangeStack.draft({
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
  ranges: hunks.map((each) => ({ hunk: HunkId.of(each) })),
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
    drafting().propose(cohorts, LATER);
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
    const settledKinds = (stack: ChangeStack) =>
      stack.pullEvents().map((each) => each.kind);

    it('stays in Spotlight: it says it settled for its replay, and shapes no task’s outcome', () => {
      const stack = drafting(StackFacts.none(), true);
      stack.pullEvents();

      const ready = stack.propose(
        [invitations([layer('Everything', ['h1', 'h2', 'h3'])])],
        LATER,
      );

      expect(ready.reachesGitHub).toBe(false);
      expect(settledKinds(ready)).toEqual([
        'change-stack.settled',
        'change-stack.replay-settled',
      ]);
    });

    it('says it settled for its replay when it could not be drafted', () => {
      const stack = drafting(StackFacts.none(), true);
      stack.pullEvents();

      expect(settledKinds(stack.fail('No.', LATER))).toEqual([
        'change-stack.failed',
        'change-stack.replay-settled',
      ]);
    });

    it('is never drafted for a search run, which changes no repository', () => {
      expect(() => drafting(StackFacts.none(), false, true)).toThrow(
        NoStackForSearchesError,
      );
    });

    it('belongs to no task', () => {
      expect(() =>
        ChangeStack.draft({
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

    it('is told apart from a task run’s stack, which reaches GitHub and shapes its task’s outcome', () => {
      const stack = drafting();
      stack.pullEvents();

      const ready = stack.propose(
        [invitations([layer('Everything', ['h1', 'h2', 'h3'])])],
        LATER,
      );

      expect(ready.reachesGitHub).toBe(true);
      expect(settledKinds(ready)).toEqual([
        'change-stack.settled',
        'change-stack.shaped',
      ]);
    });
  });

  it('starts drafting, with nothing settled', () => {
    const stack = drafting();

    expect(stack.state).toBe('drafting');
    expect(stack.pullEvents().map((each) => each.kind)).toEqual([
      'change-stack.drafting-began',
    ]);
    expect(stack.repository?.value).toBe('web');
    expect(stack.cohorts).toEqual([]);
    expect(stack.settledAt).toBeNull();
  });

  it('becomes ready with a stack that places every change once, in order', () => {
    const ready = drafting().propose(
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
    expect(ready.settledAt).toEqual(LATER);
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

  it('refuses a stack that leaves a change out or places one twice', () => {
    expect(
      problemsOf([
        invitations([layer('Data model', ['h1', 'h1']), layer('API', ['h2'])]),
      ]),
    ).toEqual(['places h1 2 times', 'leaves h3 out']);
  });

  it('refuses a change the diff does not hold', () => {
    expect(
      problemsOf([
        invitations([layer('Everything', ['h1', 'h2', 'h3', 'h9'])]),
      ]),
    ).toEqual(['cohort 1, layer 1 names h9, which is not in the diff']);
  });

  it('refuses a layer that depends on itself or on a later layer', () => {
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

  it('refuses a dependency that does not say what it uses', () => {
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

  it('refuses a stack with an empty cohort or no cohorts at all', () => {
    expect(problemsOf([])).toContain('has no cohorts');
    expect(problemsOf([invitations([])])).toContain('cohort 1 has no layers');
  });

  it('fails with the reason it gives, and says so', () => {
    const drafted = drafting();
    drafted.pullEvents();

    const failed = drafted.fail('The model refused', LATER);

    expect(failed.state).toBe('failed');
    expect(failed.failure).toBe('The model refused');
    expect(failed.pullEvents().map((each) => each.kind)).toEqual([
      'change-stack.failed',
    ]);
  });

  it('settles only once', () => {
    const failed = drafting().fail('No', LATER);

    expect(() => failed.fail('Again', LATER)).toThrow(InvalidChangeStackError);
  });

  it('is leased to one worker at a time while it is drafted', () => {
    const leased = drafting().leased(NOW);

    expect(leased.owesWork).toBe(true);
    expect(leased.work.attempts).toBe(1);
    expect(leased.work.dueBy(LATER)).toBe(false);
    expect(() => leased.leased(LATER)).toThrow(InvalidChangeStackError);
    expect(leased.work.dueBy(new Date(NOW.getTime() + WORK_LEASE_MS + 1))).toBe(
      true,
    );
  });

  it('is tried again later, waiting longer each time, then given up', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const at = (day: number) => new Date(NOW.getTime() + day * DAY);

    const once = drafting().leased(at(0)).triedAgainLater(at(0));
    const twice = once.leased(at(1)).triedAgainLater(at(1));

    expect(once.state).toBe('drafting');
    expect(once.work.dueAt).toEqual(
      new Date(at(0).getTime() + WORK_BACKOFF_MS),
    );
    expect(twice.work.dueAt).toEqual(
      new Date(at(1).getTime() + WORK_BACKOFF_MS * 2),
    );

    let exhausted = drafting();
    for (let day = 0; day < MOST_WORK_ATTEMPTS; day += 1) {
      exhausted = exhausted.leased(at(day)).triedAgainLater(at(day));
    }

    expect(exhausted.state).toBe('failed');
    expect(exhausted.failure).toBe('The change stack could not be drafted.');
    expect(exhausted.owesWork).toBe(false);
  });

  it('owes no more work once it settles', () => {
    const ready = drafting()
      .leased(NOW)
      .propose([invitations([layer('Everything', ['h1', 'h2', 'h3'])])], LATER);

    expect(ready.owesWork).toBe(false);
    expect(ready.work.attempts).toBe(0);
    expect(ready.triedAgainLater(LATER)).toBe(ready);
    expect(() => ready.leased(LATER)).toThrow(InvalidChangeStackError);
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

  it('refuses a stack that separates a hunk from what it uses, or puts it first', () => {
    const apart = (): string[] => {
      try {
        drafting(factsWith(USES)).propose(
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
        drafting(factsWith(USES)).propose(
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
    const ready = drafting(
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
    drafting().propose(
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
      work: ready().work,
      spent: ModelUsage.none(),
      request: ready().request,
      reordering: false,
      version: 1,
      ...over,
    });

  it('takes a stack back as it was left', () => {
    expect(stored({}).state).toBe('ready');
  });

  it('refuses a ready stack that leaves a change out, or places one twice', () => {
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

    expect(() => stored({ cohorts: twice })).toThrow('places h1 2 times');
  });

  it('refuses a stack that is ready with nothing placed, or failed without saying why', () => {
    expect(() => stored({ cohorts: [] })).toThrow(
      'is ready, yet places nothing',
    );

    expect(() =>
      stored({
        cohorts: [],
        progress: StackProgress.rehydrate({
          state: 'failed',
          failure: null,
          draftedAt: NOW,
          settledAt: LATER,
        }),
      }),
    ).toThrow('failed without saying why');
  });

  it('refuses a stack that is still drafting, yet holds cohorts', () => {
    expect(() =>
      stored({
        progress: StackProgress.drafting(NOW),
      }),
    ).toThrow('is still drafting, yet already holds cohorts');
  });
});
