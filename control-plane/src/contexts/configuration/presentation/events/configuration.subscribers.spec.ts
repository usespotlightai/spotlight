import type { AbandonTeamProfiles } from '@configuration/application/services/abandon-team-profiles.service';
import type { AbandonTeamSkills } from '@configuration/application/services/abandon-team-skills.service';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('configuration hearing a team disband', () => {
  it('abandons whatever skills the team still has', async () => {
    const abandoning = { of: vi.fn(async () => {}) };
    const subscriber = configurationSubscribers(
      abandoning as unknown as AbandonTeamSkills,
      { of: vi.fn() } as unknown as AbandonTeamProfiles,
    ).find(
      (each) => each.name === 'configuration.abandon-skills-of-disbanded-team',
    );

    await subscriber?.handle({
      kind: 'identity.team-disbanded.v1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      key: 'core',
    } as never);

    expect(abandoning.of).toHaveBeenCalledWith(
      TeamId.of('team_1'),
      WorkspaceId.of('ws_1'),
    );
  });
});
