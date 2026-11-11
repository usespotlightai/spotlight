import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { ConnectedIntegrationsPort } from '@integrations/application/ports/connected-integrations.port';
import type {
  TeamIntegrationReading,
  TeamIntegrationReadingsPort,
} from '@integrations/application/ports/team-integration-readings.port';
import { TeamIntegrationsHandler } from '@integrations/application/queries/handlers/team-integrations.handler';
import { TeamIntegrationsQuery } from '@integrations/application/queries/team-integrations.query';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = {
  teamId: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
};

const reading = (
  over: {
    workspace?: null;
    defined?: boolean;
    linkedAccount?: string | null;
    refreshFailedAt?: Date;
    requiresConnection?: boolean;
    spec?: boolean;
  } = {},
) =>
  new TeamIntegrationsHandler(
    {
      inWorkspaceOfTeam: vi.fn(async () =>
        over.workspace === null ? null : TEAM,
      ),
    } as unknown as WorkspaceAccessPort,
    {
      ofTeam: vi.fn(async (): Promise<readonly TeamIntegrationReading[]> =>
        over.defined === false
          ? []
          : [
              {
                integration: 'linear',
                name: 'Linear',
                path: 'integrations/linear',
                requiresConnection: over.requiresConnection ?? false,
                actsAs: 'team',
                spec: over.spec
                  ? {
                      kind: 'openapi',
                      tools: 19,
                      readAt: new Date('2026-10-05T12:00:00.000Z'),
                      problem: null,
                    }
                  : null,
              },
            ],
      ),
    } satisfies TeamIntegrationReadingsPort,
    {
      ofTeam: vi.fn(async () =>
        over.linkedAccount === undefined
          ? []
          : [
              {
                integration: 'linear',
                linkedAccount: over.linkedAccount,
                refreshFailedAt: over.refreshFailedAt ?? null,
              },
            ],
      ),
    } satisfies ConnectedIntegrationsPort,
  );

const query = () => new TeamIntegrationsQuery('team_1', 'user_1');

describe('TeamIntegrationsHandler', () => {
  it('says which integrations the team has', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations.map((each) => each.integration)).toEqual([
      'linear',
    ]);
  });

  it('says how many tools the API spec it names lists, and when it was read', async () => {
    const read = await reading({ spec: true }).execute(query());

    expect(read?.integrations[0]?.spec).toEqual({
      kind: 'openapi',
      tools: 19,
      readAt: '2026-10-05T12:00:00.000Z',
      problem: null,
    });
    expect(
      (await reading().execute(query()))?.integrations[0]?.spec,
    ).toBeNull();
  });

  it('says which resource defines each integration', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations[0]?.path).toBe('integrations/linear');
  });

  it('says an integration is disconnected where it requires a connection and the team has not authorized it', async () => {
    const read = await reading({ requiresConnection: true }).execute(query());

    expect(read?.integrations[0]).toMatchObject({
      connectionStatus: 'disconnected',
      linkedAccount: null,
    });
  });

  it('says an integration is connected, and the account name of the team, once the team has authorized it', async () => {
    const read = await reading({
      requiresConnection: true,
      linkedAccount: 'Acme',
    }).execute(query());

    expect(read?.integrations[0]).toMatchObject({
      connectionStatus: 'connected',
      linkedAccount: 'Acme',
    });
  });

  it('says an integration is disconnected once refreshing the team’s connection failed', async () => {
    const read = await reading({
      requiresConnection: true,
      linkedAccount: 'Acme',
      refreshFailedAt: new Date('2026-11-07T10:00:00.000Z'),
    }).execute(query());

    expect(read?.integrations[0]?.connectionStatus).toBe('disconnected');
  });

  it('says an integration needs no connection where it requires none', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations[0]?.connectionStatus).toBe('not-required');
  });

  it('lists nothing where the team has no integrations', async () => {
    const read = await reading({ defined: false }).execute(query());

    expect(read).toEqual({ integrations: [] });
  });

  it('answers with nothing where the team is not the caller’s', async () => {
    expect(await reading({ workspace: null }).execute(query())).toBeNull();
  });
});
