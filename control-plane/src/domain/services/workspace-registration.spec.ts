import { WorkspaceSlugTakenError } from '@domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceSlugRegistry } from '@domain/repositories/workspace.repository';
import { WorkspaceRegistration } from '@domain/services/workspace-registration';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

const registry = (taken: boolean): WorkspaceSlugRegistry => ({
  isTaken: async () => taken,
});

const register = (slugs: WorkspaceSlugRegistry, teamName = 'Platform') => {
  let next = 0;
  return new WorkspaceRegistration(slugs).register({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme Inc.'),
    slug: WorkspaceSlug.of('acme-inc'),
    teamName: TeamName.of(teamName),
    owner: UserId.of('user_1'),
    newId: () => `id_${++next}`,
  });
};

describe('WorkspaceRegistration', () => {
  it('hands back a workspace when the slug belongs to nobody', async () => {
    const { workspace } = await register(registry(false));

    expect(workspace.slug.value).toBe('acme-inc');
  });

  // Neither is worth having without the other, so both are made together.
  it('opens it with a team belonging to it', async () => {
    const { workspace, firstTeam } = await register(registry(false));

    expect(workspace.teams).toEqual([firstTeam.id]);
    expect(firstTeam.workspaceId).toEqual(workspace.id);
  });

  // The workspace's name is the workspace's. A person names the team.
  it('takes the team name it was given rather than the workspace name', async () => {
    const { firstTeam } = await register(registry(false), 'Payments');

    expect(firstTeam.name.value).toBe('Payments');
    expect(firstTeam.key.value).toBe('payments');
  });

  // A team opened is the team's own news.
  it('has the team say it was opened', async () => {
    const { firstTeam } = await register(registry(false));

    expect(firstTeam.happened).toHaveLength(1);
  });

  it('refuses a slug already on the register', async () => {
    await expect(register(registry(true))).rejects.toThrow(
      WorkspaceSlugTakenError,
    );
  });
});
