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
                        expected: 'The address the admin typed.',
                      },
                    },
                  ],
                },
              ],
            },
          ],
          check: null,
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
            expected: 'The address the admin typed.',
          },
        },
      ],
    });
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
          check: {
            command: 'npm test',
            status: 'checked',
            skip: null,
            wholeFailed: true,
            whole: step,
            layers: [step],
          },
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
});
