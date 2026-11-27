import type {
  AssistOrder,
  AssistState,
} from '@assist/application/ports/assist-sessions.port';
import type { ChangeStackGenerationRequest } from '@change-review/application/ports/change-stack-generator.port';
import { SESSION_WAITING } from '@change-review/application/ports/session-waiting';
import { factsOf } from '@change-review/domain/services/diff-facts';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { DraftingRound } from '@change-review/domain/value-objects/drafting-round.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { SessionFailure } from '@change-review/domain/value-objects/session-failure.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import { StackProblem } from '@change-review/domain/value-objects/stack-problem.vo';
import {
  AssistChangeStackGenerator,
  briefingOf,
  CHANGE_STACK_RESULT,
  connectionsOf,
  describeProblem,
  previousFileOf,
  redraftFileOf,
} from '@change-review/infrastructure/change-stacks/assist-change-stack.generator';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { optionalItems } from '@change-review/testing/optional-items.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const { diff: DIFF } = new GitDiffReader().read(
  [
    'diff --git a/src/invite.ts b/src/invite.ts',
    '--- a/src/invite.ts',
    '+++ b/src/invite.ts',
    '@@ -1 +1 @@',
    '-before',
    '+export function invite() {}',
  ].join('\n'),
);

const COHORTS = [
  {
    kind: 'change',
    title: 'Invitations',
    intent: 'Let admins invite people',
    joinedBecause: null,
    layers: [
      {
        title: 'Add invite',
        summary: 'The function',
        dependsOn: [],
        ranges: [{ hunk: 'h1' }],
        files: [
          {
            path: 'src/invite.ts',
            note: 'Adds the function that sends an invitation.',
          },
        ],
        questions: [
          {
            question: 'What happens when the address is already a member?',
            answer: 'It sends no invitation and answers 409.',
            hunks: ['h1', 'H7 '],
          },
        ],
      },
    ],
  },
];

const REQUEST: ChangeStackGenerationRequest = {
  workspaceId: 'workspace-1',
  round: DraftingRound.draft(ChangeStackId.of('stack-1'), 2),
  basedOnRun: RunId.of('run-1'),
  diff: DIFF,
  repository: RepositoryName.of('web'),
  facts: factsOf(DIFF, new PatternCodeReading()),
  problems: [StackProblem.shape('leaves h2 out')],
};

const sessions = (state: AssistState) => {
  const orders: AssistOrder[] = [];

  return {
    orders,
    generator: new AssistChangeStackGenerator({
      request: async (order) => {
        orders.push(order);
        return state;
      },
    }),
  };
};

describe('AssistChangeStackGenerator', () => {
  it('orders one change-stack session with the diff, its facts and the last problems as files', async () => {
    const { orders, generator } = sessions({
      status: 'waiting',
      since: new Date(0),
    });

    await expect(generator.generate(REQUEST)).resolves.toEqual(SESSION_WAITING);

    const [order] = optionalItems(orders);
    expect(order).toMatchObject({
      workspaceId: 'workspace-1',
      purpose: 'change-review.change-stack',
      key: 'stack-1:draft:2',
      basedOnRun: 'run-1',
    });
    expect(Object.keys(order?.files ?? {}).sort()).toEqual([
      'diff.md',
      'problems.md',
      'stack.schema.json',
    ]);
    expect(order?.files['diff.md']).toContain('Repository: web');
    expect(order?.files['diff.md']).toContain('## src/invite.ts');
    expect(order?.files['diff.md']).toContain('### h1 (+1 −1)');
    expect(order?.files['problems.md']).toContain('- The stack leaves h2 out');
    expect(JSON.parse(order?.files['stack.schema.json'] ?? '{}')).toEqual(
      CHANGE_STACK_RESULT.json,
    );
  });

  it('briefs the session on the rules, the files to read and how to submit', () => {
    const briefing = briefingOf(REQUEST);

    expect(briefing).toContain('Read these files in .spotlight/assist first');
    expect(briefing).toContain('- problems.md: the problems of the last draft');
    expect(briefing).not.toContain('previous-stack.md');
    expect(briefing).toContain(
      'exactly one entry in "files" for every file its ranges touch',
    );
    expect(briefing).toContain(
      'No tool finds the answer: the compiler, the linter and the existing tests cannot answer it.',
    );
    expect(briefing).toContain('`spotlight submit <file>`');
    expect(briefing).toContain('fix them and submit again');
    expect(briefing).not.toContain('—');
  });

  it('names the previous stack and the redraft only when there are some', () => {
    const briefing = briefingOf({
      ...REQUEST,
      problems: [],
      redraft: { command: 'npx tsc --noEmit', stack: [], failed: [] },
    });

    expect(briefing).toContain('- redraft.md:');
    expect(briefing).not.toContain('problems.md:');
  });

  it('reads the submitted stack in the stack’s own shape and leaves its hunk ids as written, with the session’s usage', async () => {
    const usage = { inputTokens: 1_000, outputTokens: 200, cost: null };
    const { generator } = sessions({
      status: 'submitted',
      result: { cohorts: COHORTS },
      usage,
      model: 'claude-code',
    });

    expect(await generator.generate(REQUEST)).toEqual({
      status: 'drafted',
      usage,
      cohorts: [
        {
          ...COHORTS[0],
          layers: [
            {
              title: 'Add invite',
              summary: 'The function',
              dependsOn: [],
              hunks: [{ hunk: 'h1' }],
              notes: [
                {
                  path: 'src/invite.ts',
                  note: 'Adds the function that sends an invitation.',
                },
              ],
              questions: [
                {
                  question:
                    'What happens when the address is already a member?',
                  answer: 'It sends no invitation and answers 409.',
                  hunks: ['h1', 'H7 '],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('reports a session that failed, and one whose result does not fit the stack', async () => {
    expect(
      await sessions({
        status: 'failed',
        reason: 'no-harness',
      }).generator.generate(REQUEST),
    ).toEqual({ status: 'failed', failure: SessionFailure.of('no-harness') });
    expect(
      await sessions({
        status: 'submitted',
        result: { cohorts: 'none' },
        usage: null,
        model: 'claude-code',
      }).generator.generate(REQUEST),
    ).toEqual({ status: 'failed', failure: SessionFailure.of('no-result') });
  });

  it('refuses a stack at submission with the field that is wrong, so the session can fix it', () => {
    const parsed = CHANGE_STACK_RESULT.schema.safeParse({
      cohorts: [
        {
          ...COHORTS[0],
          layers: [{ ...COHORTS[0]?.layers[0], files: undefined }],
        },
      ],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((each) => each.path)).toEqual([
      ['cohorts', 0, 'layers', 0, 'files'],
    ]);
  });
});

describe('describeProblem', () => {
  it('tells the next session how to mend a problem it can mend by itself', () => {
    expect(describeProblem(StackProblem.shape('leaves h2 out'))).toBe(
      'leaves h2 out',
    );
    expect(
      describeProblem(
        StackProblem.of(
          'unconnected',
          'cohort 1 joins changes the code does not connect (h1 | h2)',
        ),
      ),
    ).toBe(
      'cohort 1 joins changes the code does not connect (h1 | h2); split it, or set joinedBecause',
    );
  });
});

describe('connectionsOf', () => {
  const hunk = (id: string, linkable = true) => ({
    hunk: HunkId.of(id),
    path: `src/${id}.ts`,
    fileClass: 'source' as const,
    incidental: false,
    renamed: false,
    moved: false,
    linkable,
    defines: [],
    outside: [],
  });
  const uses = (from: string, to: string) => ({
    kind: 'uses' as const,
    from: HunkId.of(from),
    to: HunkId.of(to),
    because: ['invite'],
  });

  it('lists the groups of hunks the code connects, without the hunks it cannot read', () => {
    expect(
      connectionsOf({
        hunks: [
          hunk('h1'),
          hunk('h2'),
          hunk('h3'),
          hunk('h4'),
          hunk('h5', false),
        ],
        links: [uses('h2', 'h1')],
        imports: [],
      }),
    ).toBe(
      [
        'The code connects the hunks it can read into 3 groups. A cohort of kind "change" with hunks of more than one group needs a joinedBecause. Hunks not named here are in files the code facts do not cover, so they can go in any cohort.',
        'group 1: h1, h2',
        'one group each, connected to no other hunk: h3, h4',
      ].join('\n'),
    );
  });

  it('says nothing when the code connects every hunk it can read', () => {
    expect(
      connectionsOf({
        hunks: [hunk('h1'), hunk('h2'), hunk('h3', false)],
        links: [uses('h2', 'h1')],
        imports: [],
      }),
    ).toBeNull();
  });
});

describe('redraftFileOf', () => {
  it('requests the few changes a failing layer needs to move, with what the check printed and where the named files sit', () => {
    const text = redraftFileOf({
      command: 'npx tsc --noEmit',
      stack: [
        {
          title: 'Labels',
          layers: [
            { title: 'Task reads', hunks: [HunkId.of('h1')] },
            { title: 'HTTP', hunks: [HunkId.of('h2')] },
          ],
        },
      ],
      failed: [
        {
          cohort: 0,
          layer: 0,
          title: 'Task reads',
          output: 'mapper.spec.ts(5,7): error TS2741',
          named: [
            {
              path: 'src/mapper.spec.ts',
              hunks: [{ hunk: HunkId.of('h2'), layer: 1 }],
            },
          ],
        },
      ],
    });

    expect(text).toContain('`npx tsc --noEmit`');
    expect(text).toContain('moving the few changes it needs');
    expect(text).toContain('a note on each file its ranges touch');
    expect(text).toContain(
      'cohort 1 "Labels": layer 1 "Task reads" (h1); layer 2 "HTTP" (h2)',
    );
    expect(text).toContain('cohort 1, layer 1 "Task reads" does not build');
    expect(text).toContain('src/mapper.spec.ts: h2 in layer 2');
  });
});

describe('previousFileOf', () => {
  const FACTS = {
    hunks: [
      {
        hunk: HunkId.of('h1'),
        path: 'src/invite.ts',
        fileClass: 'source' as const,
        incidental: false,
        renamed: false,
        moved: false,
        linkable: true,
        defines: [],
        outside: [],
      },
      {
        hunk: HunkId.of('h2'),
        path: 'package-lock.json',
        fileClass: 'lockfile' as const,
        incidental: true,
        renamed: false,
        moved: false,
        linkable: false,
        defines: [],
        outside: [],
      },
    ],
    links: [],
    imports: [],
  };
  const PREVIOUS = {
    stackId: ChangeStackId.of('stack-1'),
    addedHunks: [HunkId.of('h1'), HunkId.of('h2')],
    pathOfHunk: new Map(),
    diffUnchanged: false,
    cohorts: [
      {
        kind: 'change' as const,
        title: 'Invitations',
        intent: 'Let admins invite people',
        joinedBecause: null,
        layers: [
          {
            id: LayerId.of('c1.l1'),
            title: 'Add invite',
            summary: 'The function',
            dependsOn: [],
            hunks: [HunkId.of('h1')],
            paths: ['src/invite.ts'],
            fullyKept: true,
            notes: [],
            questions: [
              {
                question: 'What happens to a member?',
                answer: 'It answers 409.',
                hunks: [HunkId.of('h1')],
              },
            ],
          },
        ],
      },
      {
        kind: 'incidental' as const,
        title: 'Update lockfiles',
        intent: 'Incidental',
        joinedBecause: null,
        layers: [
          {
            id: LayerId.of('c2.l1'),
            title: 'Update lockfiles',
            summary: 'Lockfiles',
            dependsOn: [],
            hunks: [HunkId.of('h2')],
            paths: ['package-lock.json'],
            fullyKept: true,
            notes: [],
            questions: [],
          },
        ],
      },
    ],
  };

  it('shows the earlier stack, its questions and the changed hunks, without what Spotlight places itself', () => {
    const text = previousFileOf(PREVIOUS, FACTS) ?? '';

    expect(text).toContain(
      'cohort 1 "Invitations": Let admins invite people\nlayer 1 "Add invite" (h1): The function\n  question: What happens to a member?\n  answer: It answers 409.',
    );
    expect(text).toContain('These hunks are new or changed since then: h1.');
    expect(text).not.toContain('lockfiles');
    expect(text).toContain('word for word');
  });

  it('shows nothing when no earlier hunk is still there', () => {
    expect(
      previousFileOf(
        { ...PREVIOUS, cohorts: PREVIOUS.cohorts.slice(1) },
        FACTS,
      ),
    ).toBeNull();
  });
});
