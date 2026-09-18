import type {
  WorkspaceAccessPort,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import { EnrolRunnerHandler } from '@runners/application/commands/handlers/enrol-runner.handler';
import { EnrolRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const member = (administers: boolean): WorkspaceMembership => ({
  workspaceId: WorkspaceId.of('ws_1'),
  slug: 'acme',
  viewer: UserId.of('user_1'),
  administers,
});

const enrolling = (given: { membership?: WorkspaceMembership | null } = {}) => {
  const add = vi.fn(async (_: Runner) => {});

  const handler = new EnrolRunnerHandler(
    {
      inWorkspace: vi.fn(async () =>
        given.membership === undefined ? member(true) : given.membership,
      ),
    } as unknown as WorkspaceAccessPort,
    { add } as unknown as RunnerRepository,
    {
      generate: () => '123e4567-e89b-42d3-a456-426614174000',
    } as IdGeneratorPort,
    {
      mint: () => ({ token: 'tok', hash: 'a'.repeat(64) }),
    } as unknown as TokenMintPort,
  );

  return { handler, add };
};

const enrol = new EnrolRunnerCommand('acme', 'user_1', 'runner-1');

describe('EnrolRunnerHandler', () => {
  it('hands back the token the runner is to use', async () => {
    const { handler } = enrolling();

    await expect(handler.execute(enrol)).resolves.toMatchObject({
      name: 'runner-1',
      token: 'tok',
    });
  });

  it('keeps only the hash of it', async () => {
    const { handler, add } = enrolling();

    await handler.execute(enrol);

    expect(add.mock.calls[0]?.[0]).toMatchObject({
      tokenHash: { value: 'a'.repeat(64) },
    });
  });

  it('enrols the runner into the workspace it was asked from', async () => {
    const { handler, add } = enrolling();

    await handler.execute(enrol);

    expect(add.mock.calls[0]?.[0].workspaceId.value).toBe('ws_1');
  });

  it('refuses a member who does not administer the workspace', async () => {
    const { handler, add } = enrolling({ membership: member(false) });

    await expect(handler.execute(enrol)).rejects.toThrow(UseCaseFault);
    await expect(handler.execute(enrol)).rejects.toMatchObject({
      kind: 'not-allowed',
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('answers nothing for a workspace the caller is not in', async () => {
    const { handler, add } = enrolling({ membership: null });

    await expect(handler.execute(enrol)).resolves.toBeNull();
    expect(add).not.toHaveBeenCalled();
  });
});
