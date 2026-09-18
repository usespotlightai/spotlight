import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SetUpLinesHandler } from '@work/application/commands/handlers/set-up-lines.handler';
import { SetUpLinesCommand } from '@work/application/commands/set-up-lines.command';
import type { SeedConfiguration } from '@work/application/services/seed-configuration.service';
import type { SettleSetup } from '@work/application/services/settle-setup.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { describe, expect, it, vi } from 'vitest';

const line = (key: string) => {
  let next = 0;
  return Line.open({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    line: { ...(BUILT_IN_LINES[0] as LineOpening), key: LineKey.of(key) },
    newId: () => `${key}_${++next}`,
  });
};

const setting = (over: { allowed?: boolean; configured?: boolean } = {}) => {
  const rendered: Line[][] = [];
  const seed = vi.fn(async (_team, lines: readonly Line[]) => {
    rendered.push([...lines]);
    return over.configured === false
      ? null
      : { url: 'https://github.com/acme/config/pull/1' };
  });
  const save = vi.fn();
  const settling = vi.fn(async () => {});

  const handler = new SetUpLinesHandler(
    {
      viewableBy: vi.fn(),
      mayView: vi.fn(),
      inWorkspace: vi.fn(),
      onTeam: vi.fn(async () => ({
        workspaceId: WorkspaceId.of('ws_1'),
        slug: 'acme',
        viewer: UserId.of('user_1'),
        teamId: TeamId.of('team_1'),
        administers: over.allowed !== false,
      })),
    } satisfies WorkspaceAccessPort,
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
    const { handler } = setting({ configured: false });

    await expect(run(handler)).resolves.toBeNull();
  });
});
