import { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import { WorkspaceSlugTakenError } from '@identity/domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceSlugRegistry } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceRegistration } from '@identity/domain/services/workspace-registration';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
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
  });

describe('WorkspaceRegistration', () => {
  it('hands back a workspace when the slug belongs to nobody', async () => {
    const workspace = await register(registry(false));

    expect(workspace.slug.value).toBe('acme-inc');
  });

  it('says the workspace opened, naming the first team it should hold', async () => {
    const workspace = await register(registry(false), 'Payments');

    expect(workspace.pullEvents()).toEqual([
      new WorkspaceOpened(WorkspaceId.of('ws_1'), UserId.of('user_1'), {
        id: TeamId.of('team_1'),
        name: TeamName.of('Payments'),
      }),
    ]);
  });

  it('refuses a slug already on the register', async () => {
    await expect(register(registry(true))).rejects.toThrow(
      WorkspaceSlugTakenError,
    );
  });
});
