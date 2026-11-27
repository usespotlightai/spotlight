import type {
  DirectoryWorkspace,
  WorkspaceDirectoryPort,
} from '@identity/application/ports/workspace-directory.port';
import { ListWorkspaceSummariesHandler } from '@identity/application/queries/handlers/list-workspace-summaries.handler';
import { ReadWorkspaceSummaryHandler } from '@identity/application/queries/handlers/read-workspace-summary.handler';
import { ListWorkspaceSummariesQuery } from '@identity/application/queries/list-workspace-summaries.query';
import { ReadWorkspaceSummaryQuery } from '@identity/application/queries/read-workspace-summary.query';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const listing = (id: string, memberCount: number): DirectoryWorkspace => ({
  id: WorkspaceId.of(id),
  slug: id.replace('ws_', ''),
  name: id,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  memberCount,
});

const ACME = listing('ws_acme', 3);

const GLOBEX = listing('ws_globex', 1);

const workspaces = (
  found: readonly DirectoryWorkspace[],
): WorkspaceDirectoryPort => ({
  list: vi.fn().mockResolvedValue({ items: found, next: 'cursor_2' }),
  find: vi.fn((id: WorkspaceId) =>
    Promise.resolve(found.find((each) => each.id.equals(id)) ?? null),
  ),
});

describe('ListWorkspaceSummariesHandler', () => {
  it('gives each workspace of the page with its member count', async () => {
    const listed = workspaces([ACME, GLOBEX]);
    const created = new Date('2026-08-01T00:00:00.000Z');

    await expect(
      new ListWorkspaceSummariesHandler(listed).execute(
        new ListWorkspaceSummariesQuery('cursor_1', 2, created),
      ),
    ).resolves.toEqual({
      items: [
        {
          id: 'ws_acme',
          slug: 'acme',
          name: 'ws_acme',
          createdAt: '2026-09-01T00:00:00.000Z',
          memberCount: 3,
        },
        expect.objectContaining({ id: 'ws_globex', memberCount: 1 }),
      ],
      next: 'cursor_2',
    });
    expect(listed.list).toHaveBeenCalledWith({
      after: 'cursor_1',
      limit: 2,
      since: created,
    });
  });
});

describe('ReadWorkspaceSummaryHandler', () => {
  it('gives one workspace with its member count, and nothing else', async () => {
    await expect(
      new ReadWorkspaceSummaryHandler(workspaces([ACME])).execute(
        new ReadWorkspaceSummaryQuery('ws_acme'),
      ),
    ).resolves.toEqual({
      id: 'ws_acme',
      slug: 'acme',
      name: 'ws_acme',
      createdAt: '2026-09-01T00:00:00.000Z',
      memberCount: 3,
    });
  });

  it('finds no workspace that does not exist', async () => {
    await expect(
      new ReadWorkspaceSummaryHandler(workspaces([])).execute(
        new ReadWorkspaceSummaryQuery('ws_gone'),
      ),
    ).resolves.toBeNull();
  });
});
