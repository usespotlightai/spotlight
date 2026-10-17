import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { TeamCreated } from '@identity/domain/events/team-created.event';
import { TeamDeleted } from '@identity/domain/events/team-deleted.event';
import { TeamUpdated } from '@identity/domain/events/team-updated.event';
import { AlreadyOnTheTeamError } from '@identity/domain/exceptions/already-on-the-team.error';
import { NotInTheWorkspaceError } from '@identity/domain/exceptions/not-in-the-workspace.error';
import { TeamOutsideWorkspaceError } from '@identity/domain/exceptions/team-outside-workspace.error';
import { TeamVersionConflictError } from '@identity/domain/exceptions/team-version-conflict.error';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const OWNER = UserId.of('user_1');
const BY = attributedIn(WORKSPACE);
const SECOND = UserId.of('user_2');

const acme = (id = WORKSPACE) =>
  Workspace.rehydrate({
    id,
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [
      { userId: OWNER, role: WorkspaceRole.owner },
      { userId: SECOND, role: WorkspaceRole.member },
    ],
    version: 0,
  });

const CORE = { resource: 'team' as const, id: 'team_1', key: 'core' };

const createdAtSignUp = (name = 'Platform') => {
  let next = 0;

  return Team.createAtSignUp({
    workspaceId: WORKSPACE,
    name: TeamName.of(name),
    createdBy: OWNER,
    id: TeamId.of(`team_${++next}`),
    by: BY,
  });
};

describe('Team', () => {
  it('starts with whoever created it as its owner', () => {
    expect(createdAtSignUp().members).toEqual([OWNER]);
  });

  it('belongs to the workspace it was created in', () => {
    expect(createdAtSignUp().workspaceId).toEqual(WORKSPACE);
  });

  it('takes a key from its name where nobody wrote one', () => {
    expect(createdAtSignUp('Platform Engineering').key.value).toBe(
      'platform-engineering',
    );
    expect(
      Team.createAtSignUp({
        workspaceId: WORKSPACE,
        name: TeamName.of('Platform'),
        key: TeamKey.of('core'),
        createdBy: OWNER,
        id: TeamId.of('team_1'),
        by: BY,
      }).key.value,
    ).toBe('core');
  });

  it('says it was created at sign-up', () => {
    const [raised, ...rest] = createdAtSignUp().pullEvents();

    expect(rest).toHaveLength(0);
    expect(raised).toBeInstanceOf(TeamCreated);
    expect((raised as TeamCreated).workspaceId).toEqual(WORKSPACE);
  });

  it('says nothing of the sort once it has been read back', () => {
    expect(
      Team.rehydrate({
        id: createdAtSignUp().id,
        workspaceId: WORKSPACE,
        key: TeamKey.of('platform'),
        name: TeamName.of('Platform'),
        members: [OWNER],
        version: 0,
      }).pullEvents(),
    ).toEqual([]);
  });

  it('says who is on it', () => {
    expect(createdAtSignUp().hasMember(OWNER)).toBe(true);
    expect(createdAtSignUp().hasMember(UserId.of('stranger'))).toBe(false);
  });

  it('takes somebody on once, and says so', () => {
    const joined = createdAtSignUp().join(SECOND, acme()).join(SECOND, acme());

    expect(joined.members).toEqual([OWNER, SECOND]);
    expect(joined.pullEvents().map((each) => each.kind)).toEqual([
      'team.created',
      'team.member-joined',
    ]);
  });

  it('takes on only somebody already in its workspace', () => {
    expect(() => createdAtSignUp().join(UserId.of('stranger'), acme())).toThrow(
      NotInTheWorkspaceError,
    );
    expect(() =>
      createdAtSignUp().join(SECOND, acme(WorkspaceId.of('ws_2'))),
    ).toThrow(TeamOutsideWorkspaceError);
  });

  it('does not add somebody already on it', () => {
    const joined = createdAtSignUp().addMember(SECOND, acme());

    expect(joined.hasMember(SECOND)).toBe(true);
    expect(() => joined.addMember(SECOND, acme())).toThrow(
      AlreadyOnTheTeamError,
    );
  });

  it('keeps the version it was read at, for the repository to check', () => {
    const read = Team.rehydrate({
      id: TeamId.of('team_1'),
      workspaceId: WORKSPACE,
      key: TeamKey.of('platform'),
      name: TeamName.of('Platform'),
      members: [OWNER],
      version: 4,
    });

    expect(read.rename(TeamName.of('Core')).version).toBe(4);
    expect(read.join(SECOND, acme()).version).toBe(4);
  });

  it('does not read back a team nobody is on', () => {
    expect(() =>
      Team.rehydrate({
        id: TeamId.of('team_1'),
        workspaceId: WORKSPACE,
        key: TeamKey.of('platform'),
        name: TeamName.of('Platform'),
        members: [],
        version: 0,
      }),
    ).toThrow(/no members/);
  });

  it('is the same team as another that has its identity', () => {
    const created = createdAtSignUp();

    expect(created.equals(created.rename(TeamName.of('Renamed')))).toBe(true);
  });

  describe('as a resource', () => {
    const created = () =>
      Team.create({
        id: TeamId.of('team_1'),
        workspaceId: WORKSPACE,
        key: TeamKey.of('core'),
        name: TeamName.of('Core'),
        createdBy: OWNER,
        by: BY,
      });

    const stored = (version = 3) =>
      Team.rehydrate({
        id: TeamId.of('team_1'),
        workspaceId: WORKSPACE,
        key: TeamKey.of('core'),
        name: TeamName.of('Core'),
        members: [OWNER],
        version,
      });

    it('says it was created through configuration, which opens no lines for it', () => {
      expect(created().pullEvents()).toEqual([
        new TeamCreated(
          WORKSPACE,
          TeamId.of('team_1'),
          OWNER,
          'configuration',
          ConfigurationChange.created(CORE, BY),
        ),
      ]);
    });

    it('starts with whoever created it as a member', () => {
      expect(created().members).toEqual([OWNER]);
    });

    it('rejects a change made against another version', () => {
      expect(() => stored(3).assertVersion(2)).toThrow(
        TeamVersionConflictError,
      );
      expect(() => stored(3).assertVersion(3)).not.toThrow();
    });

    it('takes a new name, and says so', () => {
      const renamed = stored().update(
        { key: TeamKey.of('core'), name: TeamName.of('Core platform') },
        BY,
      );

      expect(renamed.name.value).toBe('Core platform');
      expect(renamed.pullEvents()).toEqual([
        new TeamUpdated(
          WORKSPACE,
          TeamId.of('team_1'),
          TeamKey.of('core'),
          ConfigurationChange.updated(CORE, BY),
        ),
      ]);
    });

    it('keeps its key for its whole life', () => {
      expect(() =>
        stored().update(
          { key: TeamKey.of('platform'), name: TeamName.of('Core') },
          BY,
        ),
      ).toThrow(ImmutableFieldError);
    });

    it('is deleted only once it has nothing', () => {
      expect(() =>
        stored().delete(Dependents.of(['line delivery', 'skill grafana']), BY),
      ).toThrow(/It still has: line delivery, skill grafana/);

      const deleted = stored().delete(Dependents.none(), BY);

      expect(deleted.isDeleted).toBe(true);
      expect(deleted.pullEvents()).toEqual([
        new TeamDeleted(
          WORKSPACE,
          TeamId.of('team_1'),
          TeamKey.of('core'),
          ConfigurationChange.deleted(CORE, BY),
        ),
      ]);
      expect(() => deleted.delete(Dependents.none(), BY)).toThrow(
        InconsistentStateError,
      );
    });
  });
});
