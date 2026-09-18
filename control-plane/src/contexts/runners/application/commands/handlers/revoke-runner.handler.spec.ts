import type {
  WorkspaceAccessPort,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import { RevokeRunnerHandler } from '@runners/application/commands/handlers/revoke-runner.handler';
import { RevokeRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const NOW = new Date('2026-01-02T03:04:05.000Z');

const member = (
  workspace: string,
  administers: boolean,
): WorkspaceMembership => ({
  workspaceId: WorkspaceId.of(workspace),
  slug: workspace,
  viewer: UserId.of('user_1'),
  administers,
});

const ours = () =>
  Runner.enrol({
    id: RunnerId.of(ID),
    workspaceId: WorkspaceId.of('ws_ours'),
    name: RunnerName.of('runner-1'),
    tokenHash: TokenHash.of('a'.repeat(64)),
  });

const revoking = (membership: WorkspaceMembership | null) => {
  const save = vi.fn(async (_: Runner) => {});

  const handler = new RevokeRunnerHandler(
    {
      inWorkspace: vi.fn(async () => membership),
    } as unknown as WorkspaceAccessPort,
    { find: vi.fn(async () => ours()), save } as unknown as RunnerRepository,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save };
};

const revoke = (slug: string) => new RevokeRunnerCommand(slug, 'user_1', ID);

describe('RevokeRunnerHandler', () => {
  it('retires the token of a runner in the workspace it administers', async () => {
    const { handler, save } = revoking(member('ws_ours', true));

    await handler.execute(revoke('ws_ours'));

    expect(save.mock.calls[0]?.[0].revokedAt).toEqual(NOW);
  });

  it('will not let another workspace’s administrator revoke it', async () => {
    const { handler, save } = revoking(member('ws_theirs', true));

    await expect(handler.execute(revoke('ws_theirs'))).rejects.toMatchObject({
      kind: 'not-found',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('will not let a member who does not administer revoke it', async () => {
    const { handler, save } = revoking(member('ws_ours', false));

    await expect(handler.execute(revoke('ws_ours'))).rejects.toMatchObject({
      kind: 'not-allowed',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('knows no runner for someone outside the workspace', async () => {
    const { handler } = revoking(null);

    await expect(handler.execute(revoke('ws_ours'))).rejects.toThrow(
      UseCaseFault,
    );
  });
});
