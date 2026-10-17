import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

export const teamAccess = (
  teamId: TeamId,
  configures = true,
): WorkspaceAccessPort => {
  const permissions = {
    workspaceId: WorkspaceId.of('ws_1'),
    teamId,
    slug: 'acme',
  };

  return {
    onTeam: vi.fn(async () => ({
      ...permissions,
      viewer: UserId.of('user_1'),
      administers: configures,
    })),
    permissionsOnTeam: vi.fn(async () => ({
      ...permissions,
      configures,
      administers: configures,
    })),
  } as unknown as WorkspaceAccessPort;
};
