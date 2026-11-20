import { ChangeStackHttpMapper } from '@change-review/presentation/http/mappers/change-stack.http.mapper';
import { describe, expect, it } from 'vitest';

describe('ChangeStackHttpMapper', () => {
  it('shows each layer with its hunks and one note per file', () => {
    const response = ChangeStackHttpMapper.toResponse({
      stacks: [
        {
          id: 'stack-1',
          repository: null,
          state: 'ready',
          failure: null,
          startedAt: '2026-09-16T10:00:00.000Z',
          completedAt: '2026-09-16T10:01:00.000Z',
          files: [
            {
              path: 'src/invite.ts',
              previousPath: null,
              status: 'modified',
              binary: false,
              hunks: [
                {
                  id: 'h1',
                  oldStart: 1,
                  oldLines: 1,
                  newStart: 1,
                  newLines: 1,
                  patch: '@@ -1 +1 @@\n-a\n+b',
                },
              ],
            },
          ],
          cohorts: [
            {
              id: 'c1',
              kind: 'change',
              title: 'Invitations',
              intent: 'Invite people',
              layers: [
                {
                  id: 'c1.l1',
                  title: 'Add invite',
                  summary: 'The function',
                  dependsOn: [],
                  hunks: [{ hunk: 'h1' }],
                  notes: [
                    {
                      path: 'src/invite.ts',
                      note: 'Adds the invite function.',
                    },
                  ],
                  questions: [
                    {
                      id: 'c1.l1.q1',
                      question: 'Who gets the invitation?',
                      hunks: ['h1'],
                      answered: {
                        questionId: 'c1.l1.q1',
                        reply: null,
                        verdict: 'missed',
                        feedback: null,
                        expected: null,
                        outdated: true,
                      },
                    },
                  ],
                  revision: { status: 'modified', previous: 'c1.l2' },
                },
              ],
            },
          ],
          removed: [
            {
              previous: 'c1.l2',
              cohort: 'Invitations',
              title: 'Add invite emails',
            },
          ],
          check: null,
          runId: 'run-1',
          push: null,
        },
      ],
    });

    expect(
      JSON.parse(JSON.stringify(response.stacks[0]?.cohorts[0]?.layers[0])),
    ).toEqual({
      id: 'c1.l1',
      title: 'Add invite',
      summary: 'The function',
      hunks: [{ hunk: 'h1' }],
      notes: [{ path: 'src/invite.ts', note: 'Adds the invite function.' }],
      questions: [
        {
          id: 'c1.l1.q1',
          question: 'Who gets the invitation?',
          hunks: ['h1'],
          answered: {
            questionId: 'c1.l1.q1',
            reply: null,
            verdict: 'missed',
            feedback: null,
            expected: null,
            outdated: true,
          },
        },
      ],
      revision: { status: 'modified', previous: 'c1.l2' },
    });
    expect(JSON.parse(JSON.stringify(response.stacks[0]?.removed))).toEqual([
      { previous: 'c1.l2', cohort: 'Invitations', title: 'Add invite emails' },
    ]);
  });

  it('maps what the check ran and what each step printed', () => {
    const step = {
      step: 'whole',
      passed: true,
      output: 'ok',
      durationMs: 1200,
    };
    const response = ChangeStackHttpMapper.toResponse({
      stacks: [
        {
          id: 'stack_1',
          repository: null,
          state: 'ready',
          failure: null,
          startedAt: '2026-10-03T10:00:00.000Z',
          completedAt: null,
          files: [],
          cohorts: [],
          removed: [],
          check: {
            command: 'npm test',
            status: 'checked',
            skip: null,
            wholeFailed: true,
            whole: step,
            layers: [step],
          },
          runId: null,
          push: { head: 'b'.repeat(40), pushedBy: 'octocat' },
        },
      ],
    });

    expect(JSON.parse(JSON.stringify(response.stacks[0]?.check))).toEqual({
      command: 'npm test',
      status: 'checked',
      reason:
        'The finished change fails the check. Spotlight didn’t check its layers one by one.',
      whole: step,
      layers: [step],
    });
  });

  it('says which run or which push the stack shows', () => {
    const stack = {
      id: 'stack_1',
      repository: null,
      state: 'ready' as const,
      failure: null,
      startedAt: '2026-10-03T10:00:00.000Z',
      completedAt: null,
      files: [],
      cohorts: [],
      removed: [],
      check: null,
    };

    const response = ChangeStackHttpMapper.toResponse({
      stacks: [
        { ...stack, runId: 'run-1', push: null },
        {
          ...stack,
          runId: null,
          push: { head: 'b'.repeat(40), pushedBy: null },
        },
      ],
    });

    expect(
      JSON.parse(
        JSON.stringify(
          response.stacks.map((each) => ({
            runId: each.runId,
            push: each.push,
          })),
        ),
      ),
    ).toEqual([
      { runId: 'run-1', push: null },
      { runId: null, push: { head: 'b'.repeat(40), pushedBy: null } },
    ]);
  });
});

describe('ChangeStackHttpMapper for the public', () => {
  const keysOf = (value: unknown) => Object.keys(value as object).sort();

  const response = ChangeStackHttpMapper.toPublicResponse({
    stacks: [
      {
        id: 'stack-1',
        repository: 'acme/api',
        state: 'ready',
        files: [
          {
            path: 'src/invite.ts',
            previousPath: null,
            status: 'modified',
            binary: false,
            hunks: [
              {
                id: 'h1',
                oldStart: 1,
                oldLines: 1,
                newStart: 1,
                newLines: 1,
                patch: '@@ -1 +1 @@\n-a\n+b',
              },
            ],
          },
        ],
        cohorts: [
          {
            id: 'c1',
            kind: 'change',
            title: 'Invitations',
            intent: 'Invite people',
            layers: [
              {
                id: 'c1.l1',
                title: 'Add invite',
                summary: 'The function',
                dependsOn: [],
                hunks: [{ hunk: 'h1' }],
                notes: [{ path: 'src/invite.ts', note: 'Adds it.' }],
                questions: [
                  {
                    id: 'c1.l1.q1',
                    question: 'Who gets the invitation?',
                    hunks: ['h1'],
                    answered: { reply: 'Secret', expected: 'Secret' },
                  } as never,
                ],
                revision: { status: 'modified', previous: 'c1.l0' },
              },
            ],
          },
        ],
        removed: [{ previous: 'c9.l1', cohort: 'Old', title: 'Gone' }],
        check: { command: 'npm test' },
        runId: 'run-1',
        push: { head: 'abc', pushedBy: 'octocat' },
        failure: 'broke',
        startedAt: '2026-09-16T10:00:00.000Z',
      } as never,
    ],
  });
  const [stack] = response.stacks;
  const layer = stack?.cohorts[0]?.layers[0];

  it('names exactly the fields of a stack that anybody may read', () => {
    expect(keysOf(stack)).toEqual([
      'cohorts',
      'files',
      'id',
      'removed',
      'repository',
      'state',
    ]);
  });

  it('names exactly the fields of a layer', () => {
    expect(keysOf(layer)).toEqual([
      'hunks',
      'id',
      'notes',
      'questions',
      'revision',
      'summary',
      'title',
    ]);
  });

  it('shows a question without any answer', () => {
    expect(keysOf(layer?.questions[0])).toEqual(['hunks', 'id', 'question']);
  });

  it('carries none of what stays private', () => {
    const body = JSON.stringify(response);

    for (const hidden of ['npm test', 'run-1', 'octocat', 'broke', 'Secret']) {
      expect(body).not.toContain(hidden);
    }
  });
});
