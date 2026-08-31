import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { TeamCreated } from '@domain/events/team-created.event';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

const build = (id = 'ws_1') => {
  let next = 0;
  return Workspace.create({
    id: WorkspaceId.of(id),
    name: WorkspaceName.of('Acme Inc.'),
    slug: WorkspaceSlug.of('acme-inc'),
    owner: UserId.of('user_1'),
    newId: () => `id_${++next}`,
  });
};

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

  it('asks for a factory rather than building one itself', () => {
    const workspace = build();
    const [raised, ...rest] = workspace.happened;

    expect(rest).toHaveLength(0);
    expect(raised).toBeInstanceOf(TeamCreated);
    expect((raised as TeamCreated).teamId).toEqual(workspace.teams[0]?.id);
  });

  it('holds what it raised however often it is read', () => {
    const workspace = build();

    expect(workspace.happened).toHaveLength(1);
    expect(workspace.happened).toHaveLength(1);
  });

  it('is the same workspace as another holding its identity', () => {
    expect(build().equals(build())).toBe(true);
    expect(build().equals(build('ws_2'))).toBe(false);
  });
});
