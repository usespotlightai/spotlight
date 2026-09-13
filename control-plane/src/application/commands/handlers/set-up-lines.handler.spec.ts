import { SetUpLinesHandler } from '@application/commands/handlers/set-up-lines.handler';
import { SetUpLinesCommand } from '@application/commands/set-up-lines.command';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { SeedConfiguration } from '@application/services/seed-configuration.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import { Line } from '@domain/aggregates/line.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@domain/services/built-in-lines';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const line = (key: string) => {
  let next = 0;
  return Line.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    line: { ...(BUILT_IN_LINES[0] as LineOpening), key: LineKey.of(key) },
    newId: () => `${key}_${++next}`,
  });
};

const team = () =>
  Team.rehydrate({
    id: TeamId.of('team_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    key: TeamKey.of('platform'),
    name: TeamName.of('Platform'),
    members: [{ userId: UserId.of('user_1'), role: TeamRole.owner }],
  }).keepsConfigurationIn(Repository.of('acme/config'));

const workspace = () =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: UserId.of('user_1'), role: WorkspaceRole.owner }],
    teams: [TeamId.of('team_1')],
    connections: [],
  });

const setting = (over: { allowed?: boolean; configured?: boolean } = {}) => {
  const rendered: Line[][] = [];
  const seed = vi.fn(async (_ws, _into, lines: readonly Line[]) => {
    rendered.push([...lines]);
    return { url: 'https://github.com/acme/config/pull/1' };
  });
  const save = vi.fn();
  const settling = vi.fn(async () => {});

  const handler = new SetUpLinesHandler(
    {
      connectableBy: vi.fn(async () =>
        over.allowed === false ? null : workspace(),
      ),
    } as unknown as ConnectionAuthorization,
    {
      find: vi.fn(async () =>
        over.configured === false
          ? Team.rehydrate({
              id: TeamId.of('team_1'),
              workspaceId: WorkspaceId.of('ws_1'),
              key: TeamKey.of('platform'),
              name: TeamName.of('Platform'),
              members: [{ userId: UserId.of('user_1'), role: TeamRole.owner }],
            })
          : team(),
      ),
    } as unknown as TeamRepository,
    {
      ofTeam: vi.fn(async () => [line('delivery')]),
      save,
    } as unknown as LineRepository,
    { seed } as unknown as SeedConfiguration,
    { forTeam: settling } as unknown as SettleSetup,
  );

  const delivery = () =>
    rendered[rendered.length - 1]?.find(
      (each) => each.key.value === 'delivery',
    );

  return { handler, seed, save, settling, delivery };
};

const run = (handler: SetUpLinesHandler, repositories = ['acme/api']) =>
  handler.execute(
    new SetUpLinesCommand('team_1', 'user_1', [
      {
        key: 'delivery',
        harness: 'claude-code',
        model: 'claude-sonnet-5',
        effort: 'high',
        repositories,
      },
    ]),
  );

describe('SetUpLinesHandler', () => {
  it('renders each line’s harness and repositories into the setup, without touching the board', async () => {
    const { handler, seed, save, delivery } = setting();

    await expect(run(handler)).resolves.toEqual({
      url: 'https://github.com/acme/config/pull/1',
    });

    expect(delivery()?.repositories.all.map((each) => each.value)).toEqual([
      'acme/api',
    ]);
    expect(
      delivery()?.worked.every((each) => each.harness?.value === 'claude-code'),
    ).toBe(true);
    expect(
      delivery()?.worked.every(
        (each) => each.model?.value === 'claude-sonnet-5',
      ),
    ).toBe(true);
    expect(seed).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('runs no station where the harness is left empty', async () => {
    const { handler, delivery } = setting();

    await handler.execute(
      new SetUpLinesCommand('team_1', 'user_1', [
        {
          key: 'delivery',
          harness: null,
          model: null,
          effort: null,
          repositories: [],
        },
      ]),
    );

    expect(delivery()?.worked.every((each) => each.harness === null)).toBe(
      true,
    );
  });

  it('says nothing where the caller may not set the team up', async () => {
    const { handler, seed } = setting({ allowed: false });

    await expect(run(handler)).resolves.toBeNull();
    expect(seed).not.toHaveBeenCalled();
  });

  it('says nothing until a configuration repository is chosen', async () => {
    const { handler, seed } = setting({ configured: false });

    await expect(run(handler)).resolves.toBeNull();
    expect(seed).not.toHaveBeenCalled();
  });
});
