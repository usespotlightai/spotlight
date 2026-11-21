import { WorkspaceSecretUseLock } from '@configuration/infrastructure/acl/workspace-secret-use-lock.adapter';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { SecretUseLocksPort } from '@secrets/application/ports/secret-use-locks.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const setUp = (team: boolean) => {
  const lockUsesIn = vi.fn(async () => {});

  return {
    lockUsesIn,
    lock: new WorkspaceSecretUseLock(
      {
        find: vi.fn(async () =>
          team
            ? {
                id: TEAM,
                workspaceId: WorkspaceId.of('ws_1'),
                key: 'core',
                name: 'Core',
                members: [],
              }
            : null,
        ),
        inWorkspace: vi.fn(),
      } satisfies TeamDirectoryPort,
      { lockUsesIn } satisfies SecretUseLocksPort,
    ),
  };
};

describe('WorkspaceSecretUseLock', () => {
  it('locks the uses of the secrets in the team’s workspace', async () => {
    const { lock, lockUsesIn } = setUp(true);

    await lock.lockUsesBy(TEAM);

    expect(lockUsesIn).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
  });

  it('locks nothing for a team that no workspace has', async () => {
    const { lock, lockUsesIn } = setUp(false);

    await lock.lockUsesBy(TEAM);

    expect(lockUsesIn).not.toHaveBeenCalled();
  });
});
