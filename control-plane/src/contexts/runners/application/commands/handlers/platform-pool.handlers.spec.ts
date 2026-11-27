import { SetPlatformPoolHandler } from '@runners/application/commands/handlers/set-platform-pool.handler';
import { SetPlatformPoolCommand } from '@runners/application/commands/platform-pool.commands';
import type { PlatformPools } from '@runners/application/services/platform-pools.service';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const platformPools = () => ({
  set: vi.fn(async () => ({
    outcome: 'disabled' as const,
    allowsSecrets: true,
    allowsReviewWork: false,
  })),
});

describe('SetPlatformPoolHandler', () => {
  it('sets the platform pool of the workspace in one change and says how it stands', async () => {
    const pools = platformPools();

    await expect(
      new SetPlatformPoolHandler(partial<PlatformPools>(pools)).execute(
        new SetPlatformPoolCommand('ws_1', {
          enabled: false,
          allowsSecrets: true,
        }),
      ),
    ).resolves.toEqual({
      outcome: 'disabled',
      allowsSecrets: true,
      allowsReviewWork: false,
    });
    expect(pools.set).toHaveBeenCalledWith(WorkspaceId.of('ws_1'), {
      enabled: false,
      allowsSecrets: true,
    });
  });

  it('gives a lost race to the caller as a refusal', async () => {
    const pools = platformPools();
    pools.set.mockRejectedValue(new RunnerPoolVersionConflictError('pool_1'));

    await expect(
      new SetPlatformPoolHandler(partial<PlatformPools>(pools)).execute(
        new SetPlatformPoolCommand('ws_1', { enabled: false }),
      ),
    ).rejects.toBeInstanceOf(TranslatedDomainError);
  });
});
