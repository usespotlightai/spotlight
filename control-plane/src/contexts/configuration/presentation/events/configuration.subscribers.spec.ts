import type { DeleteTeamProfiles } from '@configuration/application/services/delete-team-profiles.service';
import type { DeleteTeamSkills } from '@configuration/application/services/delete-team-skills.service';
import type { DeleteWorkspaceStates } from '@configuration/application/services/delete-workspace-states.service';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('configuration learning that a team is deleted', () => {
  it('deletes whatever skills the team still has', async () => {
    const deleting = { deleteForTeam: vi.fn(async () => {}) };
    const subscriber = configurationSubscribers(
      deleting as unknown as DeleteTeamSkills,
      { deleteForTeam: vi.fn() } as unknown as DeleteTeamProfiles,
      { deleteForWorkspace: vi.fn() } as unknown as DeleteWorkspaceStates,
    ).find(
      (each) => each.name === 'configuration.delete-skills-of-deleted-team',
    );

    await subscriber?.handle({
      kind: 'identity.team-deleted.v1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    } as never);

    expect(deleting.deleteForTeam).toHaveBeenCalledWith(
      TeamId.of('team_1'),
      WorkspaceId.of('ws_1'),
    );
  });
});

describe('configuration learning that a workspace is deleted', () => {
  it('deletes the workspace’s Terraform states', async () => {
    const deleting = { deleteForWorkspace: vi.fn(async () => {}) };
    const subscriber = configurationSubscribers(
      { deleteForTeam: vi.fn() } as unknown as DeleteTeamSkills,
      { deleteForTeam: vi.fn() } as unknown as DeleteTeamProfiles,
      deleting as unknown as DeleteWorkspaceStates,
    ).find(
      (each) =>
        each.name ===
        'configuration.delete-terraform-states-of-deleted-workspace',
    );

    await subscriber?.handle({
      kind: 'identity.workspace-deleted.v1',
      workspaceId: 'ws_1',
      slug: 'acme',
    } as never);

    expect(deleting.deleteForWorkspace).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
    );
  });
});
