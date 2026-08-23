import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

const build = (id = 'ws_1') =>
  Workspace.create({
    id: WorkspaceId.of(id),
    name: WorkspaceName.of('Acme Inc.'),
    slug: WorkspaceSlug.of('acme-inc'),
    owner: UserId.of('user_1'),
    firstTeamId: TeamId.of('team_1'),
    firstFactoryId: FactoryId.of('factory_1'),
  });

describe('Workspace', () => {
  it('starts with its creator as the sole owner', () => {
    expect(build().members).toEqual([
      { userId: UserId.of('user_1'), role: 'owner' },
    ]);
  });

  it('is never without a team, and names the first after itself', () => {
    const [first, ...rest] = build().teams;

    expect(rest).toHaveLength(0);
    expect(first.name.value).toBe('Acme Inc.');
    expect(first.members).toEqual([
      { userId: UserId.of('user_1'), role: 'owner' },
    ]);
  });

  it('gives the first team a factory to hang its assembly lines on', () => {
    const [first] = build().teams;

    expect(first?.factory.id).toEqual(FactoryId.of('factory_1'));
  });

  it('is the same workspace as another holding its identity', () => {
    expect(build().equals(build())).toBe(true);
    expect(build().equals(build('ws_2'))).toBe(false);
  });
});
