import type { HookTokensPort } from '@integrations/application/ports/hook-tokens.port';
import type { WorkspaceHostsPort } from '@integrations/application/ports/workspace-hosts.port';
import { HookAllowancesService } from '@integrations/application/services/hook-allowances.service';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { onlyHosts } from '@integrations/infrastructure/outbound/workspace-hosts.fake-spec';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const allowances = (deployment: string, ...workspace: string[]) =>
  new HookAllowancesService(
    { ofTeam: async () => [] } as unknown as IntegrationDefinitionRepository,
    { signs: false } as unknown as HookTokensPort,
    HostAllowList.listed(deployment),
    onlyHosts(...workspace),
  ).onTeam(TeamId.of('team_1'), WorkspaceId.of('ws_1'));

describe('HookAllowancesService', () => {
  it('checks against the workspace list as it is now, not as it was cached', async () => {
    const allowed = await new HookAllowancesService(
      { ofTeam: async () => [] } as unknown as IntegrationDefinitionRepository,
      { signs: false } as unknown as HookTokensPort,
      HostAllowList.listed(''),
      {
        of: async () => HostAllowList.of(['old.example.com']),
        fresh: async () => HostAllowList.of(['new.example.com']),
      } as WorkspaceHostsPort,
    ).onTeam(TeamId.of('team_1'), WorkspaceId.of('ws_1'));

    expect(allowed.allowsHost('new.example.com')).toBe(true);
    expect(allowed.allowsHost('old.example.com')).toBe(false);
  });

  it('allows a host only when the deployment and the workspace both allow it', async () => {
    const allowed = await allowances('*.example.com', 'hooks.example.com');

    expect(allowed.allowsHost('hooks.example.com')).toBe(true);
    expect(allowed.allowsHost('other.example.com')).toBe(false);
    expect(allowed.allowsHost('hooks.elsewhere.com')).toBe(false);
  });

  it('leaves the deployment list alone for a workspace with an empty list', async () => {
    const allowed = await allowances('');

    expect(allowed.allowsHost('anything.example.com')).toBe(true);
  });
});
