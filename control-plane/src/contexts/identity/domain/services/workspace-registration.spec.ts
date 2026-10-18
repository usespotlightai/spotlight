import { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import { WorkspaceSlugTakenError } from '@identity/domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceSlugRegistry } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceRegistration } from '@identity/domain/services/workspace-registration';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const registry = (taken: boolean): WorkspaceSlugRegistry => ({
  isTaken: async () => taken,
});

const register = (slugs: WorkspaceSlugRegistry, teamName = 'Platform') =>
  new WorkspaceRegistration(slugs).register({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme Inc.'),
    slug: WorkspaceSlug.of('acme-inc'),
    firstTeam: { id: TeamId.of('team_1'), name: TeamName.of(teamName) },
    owner: UserId.of('user_1'),
    by: changeActorIn('ws_1'),
  });

describe('WorkspaceRegistration', () => {
  it('hands back a workspace when the slug belongs to nobody', async () => {
    const workspace = await register(registry(false));

    expect(workspace.slug.value).toBe('acme-inc');
  });

  it('says the workspace was created, naming the first team it should have', async () => {
    const workspace = await register(registry(false), 'Payments');

    expect(workspace.pullEvents()).toEqual([
      new WorkspaceCreated(
        WorkspaceId.of('ws_1'),
        UserId.of('user_1'),
        { id: TeamId.of('team_1'), name: TeamName.of('Payments') },
        ConfigurationChange.created(
          { resource: 'workspace', id: 'ws_1', key: 'acme-inc' },
          changeActorIn('ws_1'),
        ),
      ),
    ]);
  });

  it('rejects a slug already on the register', async () => {
    await expect(register(registry(true))).rejects.toThrow(
      WorkspaceSlugTakenError,
    );
  });
});
