import { Team } from '@identity/domain/aggregates/team.aggregate';
import { TeamCreated } from '@identity/domain/events/team-created.event';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const OWNER = UserId.of('user_1');

const open = (name = 'Platform') => {
  let next = 0;

  return Team.open({
    workspaceId: WORKSPACE,
    name: TeamName.of(name),
    openedBy: OWNER,
    id: TeamId.of(`team_${++next}`),
  });
};

describe('Team', () => {
  it('starts with whoever opened it as its owner', () => {
    expect(open().members).toEqual([OWNER]);
  });

  it('belongs to the workspace it was opened in', () => {
    expect(open().workspaceId).toEqual(WORKSPACE);
  });

  it('takes a key from its name where nobody wrote one', () => {
    expect(open('Platform Engineering').key.value).toBe('platform-engineering');
    expect(
      Team.open({
        workspaceId: WORKSPACE,
        name: TeamName.of('Platform'),
        key: TeamKey.of('core'),
        openedBy: OWNER,
        id: TeamId.of('team_1'),
      }).key.value,
    ).toBe('core');
  });

  it('says it was opened', () => {
    const [raised, ...rest] = open().pullEvents();

    expect(rest).toHaveLength(0);
    expect(raised).toBeInstanceOf(TeamCreated);
    expect((raised as TeamCreated).workspaceId).toEqual(WORKSPACE);
  });

  it('says nothing of the sort once it has been read back', () => {
    expect(
      Team.rehydrate({
        id: open().id,
        workspaceId: WORKSPACE,
        name: TeamName.of('Platform'),
        members: [OWNER],
      }).pullEvents(),
    ).toEqual([]);
  });

  it('says who is on it', () => {
    expect(open().holds(OWNER)).toBe(true);
    expect(open().holds(UserId.of('stranger'))).toBe(false);
  });

  it('takes somebody on once, and says so', () => {
    const joined = open()
      .joinedBy(UserId.of('user_2'))
      .joinedBy(UserId.of('user_2'));

    expect(joined.members).toEqual([OWNER, UserId.of('user_2')]);
    expect(joined.pullEvents().map((each) => each.kind)).toEqual([
      'team.created',
      'team.member-joined',
    ]);
  });

  it('keeps the version it was read at, for the repository to check', () => {
    const read = Team.rehydrate({
      id: TeamId.of('team_1'),
      workspaceId: WORKSPACE,
      name: TeamName.of('Platform'),
      members: [OWNER],
      version: 4,
    });

    expect(read.renamedTo(TeamName.of('Core')).version).toBe(4);
    expect(read.joinedBy(UserId.of('user_2')).version).toBe(4);
  });

  it('refuses to read back a team nobody is on', () => {
    expect(() =>
      Team.rehydrate({
        id: TeamId.of('team_1'),
        workspaceId: WORKSPACE,
        name: TeamName.of('Platform'),
        members: [],
      }),
    ).toThrow(/no members/);
  });

  it('is the same team as another holding its identity', () => {
    const held = open();

    expect(held.equals(held.renamedTo(TeamName.of('Renamed')))).toBe(true);
  });
});
