import { FirstTeam } from '@identity/application/services/first-team.service';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('FirstTeam', () => {
  it('creates the team a new workspace named, owned by who created it, and says so', async () => {
    const add = vi.fn(async (_: Team) => {});

    await new FirstTeam({
      add,
    } as unknown as TeamRepository).createFor(
      new WorkspaceCreated(
        WorkspaceId.of('ws_1'),
        UserId.of('user_1'),
        { id: TeamId.of('team_1'), name: TeamName.of('Payments') },
        ConfigurationChange.created(
          { resource: 'workspace', id: 'ws_1', key: 'acme' },
          attributedIn('ws_1'),
        ),
      ),
    );

    const [team] = add.mock.calls[0] ?? [];
    expect(team?.id).toEqual(TeamId.of('team_1'));
    expect(team?.name.value).toBe('Payments');
    expect(team?.hasMember(UserId.of('user_1'))).toBe(true);
    expect(team?.pullEvents()).toEqual([
      expect.objectContaining({
        kind: 'team.created',
        change: ConfigurationChange.created(
          { resource: 'team', id: 'team_1', key: 'payments' },
          attributedIn('ws_1'),
        ),
      }),
    ]);
  });
});
