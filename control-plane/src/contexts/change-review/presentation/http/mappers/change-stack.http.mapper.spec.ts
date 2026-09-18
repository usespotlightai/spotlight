import { ChangeStackHttpMapper } from '@change-review/presentation/http/mappers/change-stack.http.mapper';
import { describe, expect, it } from 'vitest';

describe('ChangeStackHttpMapper', () => {
  it('gives each layer its hunks and one note per file', () => {
    const response = ChangeStackHttpMapper.toResponse({
      stacks: [
        {
          id: 'stack-1',
          repository: null,
          state: 'ready',
          failure: null,
          draftedAt: '2026-09-16T10:00:00.000Z',
          settledAt: '2026-09-16T10:01:00.000Z',
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
});
