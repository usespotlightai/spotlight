import { FirstTeam } from '@identity/application/services/first-team.service';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('FirstTeam', () => {
  it('opens the team a new workspace named, owned by who opened it, and says so', async () => {
    const add = vi.fn(async (_: Team) => {});

    await new FirstTeam({
      add,
    } as unknown as TeamRepository).openFor(
      new WorkspaceOpened(WorkspaceId.of('ws_1'), UserId.of('user_1'), {
        id: TeamId.of('team_1'),
        name: TeamName.of('Payments'),
      }),
    );

    const [team] = add.mock.calls[0] ?? [];
    expect(team?.id).toEqual(TeamId.of('team_1'));
    expect(team?.name.value).toBe('Payments');
    expect(team?.holds(UserId.of('user_1'))).toBe(true);
    expect(team?.pullEvents().map((each) => each.kind)).toEqual([
      'team.created',
    ]);
  });
});
