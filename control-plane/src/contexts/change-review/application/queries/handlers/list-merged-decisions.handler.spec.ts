import type {
  DecisionReaderPort,
  MergedSought,
} from '@change-review/application/ports/decision-reader.port';
import { ListMergedDecisionsHandler } from '@change-review/application/queries/handlers/list-merged-decisions.handler';
import { ListMergedDecisionsQuery } from '@change-review/application/queries/list-merged-decisions.query';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const MERGED_AT = new Date('2026-09-20T12:00:00Z');

const listing = (over: { mayView?: boolean } = {}) => {
  const sought: MergedSought[] = [];
  const reader: DecisionReaderPort = {
    ofTask: async () => null,
    merged: async (asked) => {
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

  const handler = new ListMergedDecisionsHandler(
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
      new ListMergedDecisionsQuery(
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
  it('asks about paths as the workspace stores them, from the repository’s checkout', async () => {
    const { list, sought } = listing();

    await list('acme/api', ['src/uploads.ts', '/src/retry/'], '2026-09-01');

    expect(sought[0]).toMatchObject({
      within: ['api/src/uploads.ts', 'api/src/retry'],
      since: new Date('2026-09-01'),
      until: null,
      max: 50,
    });
    expect(sought[0]?.repository?.value).toBe('acme/api');
  });

  it('names who disputed what shipped', async () => {
    const { list } = listing();

    const found = await list('acme/api');

    expect(found?.[0]?.decisions[0]?.disputes[0]?.byName).toBe('Maya Chen');
  });

  it('rejects paths without the repository they lie in', async () => {
    const { list } = listing();

    await expect(list(null, ['src/uploads.ts'])).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('rejects a path that climbs out of the repository, or a time that is no date', async () => {
    const { list } = listing();

    await expect(list('acme/api', ['../secrets'])).rejects.toMatchObject({
      kind: 'invalid',
    });
    await expect(list('acme/api', [], 'last week')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('shows nothing to someone outside the workspace', async () => {
    const { list } = listing({ mayView: false });

    expect(await list('acme/api')).toBeNull();
  });
});
