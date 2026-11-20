import type { WorkspacePlansPort } from '@catalog/application/ports/workspace-plans.port';
import type {
  WorkspaceListing,
  WorkspacesPort,
} from '@catalog/application/ports/workspaces.port';
import { ListWorkspaceSummariesHandler } from '@catalog/application/queries/handlers/list-workspace-summaries.handler';
import { ReadWorkspaceSummaryHandler } from '@catalog/application/queries/handlers/read-workspace-summary.handler';
import { ListWorkspaceSummariesQuery } from '@catalog/application/queries/list-workspace-summaries.query';
import { ReadWorkspaceSummaryQuery } from '@catalog/application/queries/read-workspace-summary.query';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const listing = (id: string, memberCount: number): WorkspaceListing => ({
  id: WorkspaceId.of(id),
  slug: id.replace('ws_', ''),
  name: id,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  memberCount,
});

const ACME = listing('ws_acme', 3);

const GLOBEX = listing('ws_globex', 1);

const END = new Date('2027-01-01T00:00:00.000Z');

const TERMS = new Map([['ws_acme', PlanTerm.of(Plan.team, END)]]);

const workspaces = (found: readonly WorkspaceListing[]): WorkspacesPort => ({
  list: vi.fn().mockResolvedValue({ items: found, next: 'cursor_2' }),
  find: vi.fn(
    async (id: WorkspaceId) => found.find((each) => each.id.equals(id)) ?? null,
  ),
});

const plans: WorkspacePlansPort = {
  of: async (id) => TERMS.get(id.value) ?? PlanTerm.free,
  ofEach: async () => TERMS,
};

describe('ListWorkspaceSummariesHandler', () => {
  it('gives each workspace of the page with its member count and plan', async () => {
    const listed = workspaces([ACME, GLOBEX]);
    const created = new Date('2026-08-01T00:00:00.000Z');

    await expect(
      new ListWorkspaceSummariesHandler(listed, plans).execute(
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
          plan: 'team',
          planExpiresAt: '2027-01-01T00:00:00.000Z',
        },
        expect.objectContaining({
          id: 'ws_globex',
          memberCount: 1,
          plan: 'free',
          planExpiresAt: null,
        }),
      ],
      next: 'cursor_2',
    });
    expect(listed.list).toHaveBeenCalledWith({
      after: 'cursor_1',
      limit: 2,
      createdAfter: created,
    });
  });
});

describe('ReadWorkspaceSummaryHandler', () => {
  it('gives one workspace with its plan', async () => {
    await expect(
      new ReadWorkspaceSummaryHandler(workspaces([ACME]), plans).execute(
        new ReadWorkspaceSummaryQuery('ws_acme'),
      ),
    ).resolves.toMatchObject({ id: 'ws_acme', plan: 'team', memberCount: 3 });
  });

  it('finds no workspace that does not exist', async () => {
    await expect(
      new ReadWorkspaceSummaryHandler(workspaces([]), plans).execute(
        new ReadWorkspaceSummaryQuery('ws_gone'),
      ),
    ).resolves.toBeNull();
  });
});
