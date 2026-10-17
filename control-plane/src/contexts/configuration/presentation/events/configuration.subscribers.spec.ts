import type { DeleteTeamProfiles } from '@configuration/application/services/delete-team-profiles.service';
import type { DeleteTeamSkills } from '@configuration/application/services/delete-team-skills.service';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('configuration hearing that a team is deleted', () => {
  it('deletes whatever skills the team still has', async () => {
    const deleting = { deleteForTeam: vi.fn(async () => {}) };
    const subscriber = configurationSubscribers(
      deleting as unknown as DeleteTeamSkills,
      { deleteForTeam: vi.fn() } as unknown as DeleteTeamProfiles,
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
