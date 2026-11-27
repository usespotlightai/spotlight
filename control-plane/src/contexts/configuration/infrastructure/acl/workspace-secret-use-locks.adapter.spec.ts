import { WorkspaceSecretUseLocks } from '@configuration/infrastructure/acl/workspace-secret-use-locks.adapter';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { SecretUseLocksPort } from '@secrets/application/ports/secret-use-locks.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const setUp = (team: boolean) => {
  const lockWorkspace = vi.fn(async () => {});

  return {
    lockWorkspace,
    lock: new WorkspaceSecretUseLocks(
      {
        find: vi.fn(() =>
          Promise.resolve(
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
        ),
        inWorkspace: vi.fn(),
      } satisfies TeamDirectoryPort,
      { lock: lockWorkspace } satisfies SecretUseLocksPort,
    ),
  };
};

describe('WorkspaceSecretUseLocks', () => {
  it('locks the uses of the secrets in the team’s workspace', async () => {
    const { lock, lockWorkspace } = setUp(true);

    await lock.lock(TEAM);

    expect(lockWorkspace).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
  });

  it('locks nothing for a team that no workspace has', async () => {
    const { lock, lockWorkspace } = setUp(false);

    await lock.lock(TEAM);

    expect(lockWorkspace).not.toHaveBeenCalled();
  });
});
