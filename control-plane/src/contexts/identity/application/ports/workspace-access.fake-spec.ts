import type {
  TeamPermissions,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
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

  return partial<WorkspaceAccessPort>({
    inWorkspaceOfTeam: vi.fn(async () => ({
      ...permissions,
      viewer: UserId.of('user_1'),
      isAdmin: configures,
    })),
    permissionsInWorkspaceOfTeam: vi.fn(async () =>
      partial<TeamPermissions>({
        ...permissions,
        configures,
        isAdmin: configures,
      }),
    ),
  });
};
