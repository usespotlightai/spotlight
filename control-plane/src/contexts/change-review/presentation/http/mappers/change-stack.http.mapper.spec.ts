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
          draftedAt: '2026-09-16T10:00:00.000Z',
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
                  ranges: [{ hunk: 'h1' }],
                  notes: [
                    {
                      path: 'src/invite.ts',
                      note: 'Adds the invite function.',
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
      ranges: [{ hunk: 'h1' }],
      notes: [{ path: 'src/invite.ts', note: 'Adds the invite function.' }],
    });
  });

  it('maps what the check ran and what each step printed', () => {
    const step = { step: 'whole', passed: true, output: 'ok', tookMs: 1200 };
    const response = ChangeStackHttpMapper.toResponse({
      stacks: [
        {
          id: 'stack_1',
          repository: null,
          state: 'ready',
          failure: null,
          draftedAt: '2026-10-03T10:00:00.000Z',
          completedAt: null,
          files: [],
          cohorts: [],
          check: {
            command: 'npm test',
            state: 'checked',
            reason: null,
            whole: step,
            layers: [step],
          },
        },
      ],
    });

    expect(JSON.parse(JSON.stringify(response.stacks[0]?.check))).toEqual({
      command: 'npm test',
      state: 'checked',
      reason: null,
      whole: step,
      layers: [step],
    });
  });
});
