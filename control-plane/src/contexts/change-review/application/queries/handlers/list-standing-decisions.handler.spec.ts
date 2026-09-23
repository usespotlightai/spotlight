import type {
  DecisionReaderPort,
  StandingSought,
} from '@change-review/application/ports/decision-reader.port';
import { ListStandingDecisionsHandler } from '@change-review/application/queries/handlers/list-standing-decisions.handler';
import { ListStandingDecisionsQuery } from '@change-review/application/queries/list-standing-decisions.query';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const MERGED_AT = new Date('2026-09-20T12:00:00Z');

const listing = (over: { mayView?: boolean } = {}) => {
  const sought: StandingSought[] = [];
  const reader: DecisionReaderPort = {
    ofTask: async () => null,
    standing: async (asked) => {
      sought.push(asked);
      return [
        {
          taskId: 'task_1',
          runId: 'run_1',
          repository: 'acme/api',
          commit: 'c'.repeat(40),
          mergedAt: MERGED_AT,
          decisions: [
            {
              id: 'decision_1',
              kind: 'limitation',
              title: 'Retries only once',
              why: 'Backoff is not in the client yet.',
              alternatives: [],
              paths: ['api/src/uploads.ts'],
              steps: [7],
              disputes: [
                {
                  id: 'dispute_1',
                  path: 'api/src/uploads.ts',
                  by: 'user_maya',
                  byName: null,
                  reason: 'It retries twice.',
                  at: MERGED_AT,
                },
              ],
            },
          ],
        },
      ];
    },
  };

  const handler = new ListStandingDecisionsHandler(
    {
      slugOf: async () => 'acme',
      idOf: async () => WorkspaceId.of('ws_1'),
      mayView: async () => over.mayView ?? true,
    },
    reader,
    {
      find: async () => ({ name: 'Maya Chen', image: null }),
      pictureOf: () => null,
      memberOf: async () => null,
    },
  );

  const list = (
    repository: string | null,
    paths: string[] = [],
    since: string | null = null,
    until: string | null = null,
  ) =>
    handler.execute(
      new ListStandingDecisionsQuery(
        'acme',
        'user_1',
        repository,
        paths,
        since,
        until,
      ),
    );

  return { list, sought };
};

describe('listing the decisions that shipped', () => {
  it('asks about paths as the workspace holds them, from the repository’s checkout', async () => {
    const { list, sought } = listing();

    await list('acme/api', ['src/uploads.ts', '/src/retry/'], '2026-09-01');

    expect(sought[0]).toMatchObject({
      within: ['api/src/uploads.ts', 'api/src/retry'],
      since: new Date('2026-09-01'),
      until: null,
      most: 50,
    });
    expect(sought[0]?.repository?.value).toBe('acme/api');
  });

  it('names who disputed what shipped', async () => {
    const { list } = listing();

    const found = await list('acme/api');

    expect(found?.[0]?.decisions[0]?.disputes[0]?.byName).toBe('Maya Chen');
  });

  it('refuses paths without the repository they lie in', async () => {
    const { list } = listing();

    await expect(list(null, ['src/uploads.ts'])).rejects.toMatchObject({
      kind: 'invalid-input',
    });
  });

  it('refuses a path that climbs out of the repository, or a time that is no date', async () => {
    const { list } = listing();

    await expect(list('acme/api', ['../secrets'])).rejects.toMatchObject({
      kind: 'invalid-input',
    });
    await expect(list('acme/api', [], 'last week')).rejects.toMatchObject({
      kind: 'invalid-input',
    });
  });

  it('shows nothing to someone outside the workspace', async () => {
    const { list } = listing({ mayView: false });

    expect(await list('acme/api')).toBeNull();
  });
});
