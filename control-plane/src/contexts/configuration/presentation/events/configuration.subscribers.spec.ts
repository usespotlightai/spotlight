import type { DeleteTeamProfiles } from '@configuration/application/services/delete-team-profiles.service';
import type { DeleteTeamSkills } from '@configuration/application/services/delete-team-skills.service';
import type { DeleteWorkspaceStates } from '@configuration/application/services/delete-workspace-states.service';
import type { PruneStateBodies } from '@configuration/application/services/prune-state-bodies.service';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import type { TeamDeletedIntegrationEvent } from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import type { WorkspaceDeletedIntegrationEvent } from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import { anOutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('configuration learning that a team is deleted', () => {
  it('deletes whatever skills the team still has', async () => {
    const deleting = { deleteForTeam: vi.fn(async () => {}) };
    const subscriber = configurationSubscribers(
      partial<DeleteTeamSkills>(deleting),
      partial<DeleteTeamProfiles>({ deleteForTeam: vi.fn() }),
      partial<DeleteWorkspaceStates>({ deleteForWorkspace: vi.fn() }),
      partial<PruneStateBodies>({ onWritten: vi.fn() }),
    ).find(
      (each) => each.name === 'configuration.delete-skills-of-deleted-team',
    );

    const deleted: TeamDeletedIntegrationEvent = {
      kind: 'identity.team-deleted.v1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    };
    await subscriber?.handle(deleted, anOutboxRecord());

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
      partial<DeleteTeamSkills>({ deleteForTeam: vi.fn() }),
      partial<DeleteTeamProfiles>({ deleteForTeam: vi.fn() }),
      partial<DeleteWorkspaceStates>(deleting),
      partial<PruneStateBodies>({ onWritten: vi.fn() }),
    ).find(
      (each) =>
        each.name ===
        'configuration.delete-terraform-states-of-deleted-workspace',
    );

    const deleted: WorkspaceDeletedIntegrationEvent = {
      kind: 'identity.workspace-deleted.v1',
      workspaceId: 'ws_1',
      slug: 'acme',
    };
    await subscriber?.handle(deleted, anOutboxRecord());

    expect(deleting.deleteForWorkspace).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
    );
  });
});
