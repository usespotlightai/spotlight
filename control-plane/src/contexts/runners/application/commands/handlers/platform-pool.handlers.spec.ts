import { DisablePlatformPoolHandler } from '@runners/application/commands/handlers/disable-platform-pool.handler';
import { EnablePlatformPoolHandler } from '@runners/application/commands/handlers/enable-platform-pool.handler';
import {
  DisablePlatformPoolCommand,
  EnablePlatformPoolCommand,
} from '@runners/application/commands/platform-pool.commands';
import type { PlatformPools } from '@runners/application/services/platform-pools.service';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const platformPools = () => ({
  disable: vi.fn(async () => ({ outcome: 'disabled' as const })),
  enable: vi.fn(async () => ({ outcome: 'enabled' as const })),
});

describe('DisablePlatformPoolHandler', () => {
  it('disables the platform pool of the workspace and says so', async () => {
    const pools = platformPools();

    await expect(
      new DisablePlatformPoolHandler(pools as unknown as PlatformPools).execute(
        new DisablePlatformPoolCommand('ws_1'),
      ),
    ).resolves.toEqual({ outcome: 'disabled' });
    expect(pools.disable).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
    expect(pools.enable).not.toHaveBeenCalled();
  });

  it('gives a lost race to the caller as a refusal', async () => {
    const pools = platformPools();
    pools.disable.mockRejectedValue(
      new RunnerPoolVersionConflictError('pool_1'),
    );

    await expect(
      new DisablePlatformPoolHandler(pools as unknown as PlatformPools).execute(
        new DisablePlatformPoolCommand('ws_1'),
      ),
    ).rejects.toBeInstanceOf(TranslatedDomainError);
  });
});

describe('EnablePlatformPoolHandler', () => {
  it('enables the platform pool of the workspace and says so', async () => {
    const pools = platformPools();

    await expect(
      new EnablePlatformPoolHandler(pools as unknown as PlatformPools).execute(
        new EnablePlatformPoolCommand('ws_1'),
      ),
    ).resolves.toEqual({ outcome: 'enabled' });
    expect(pools.enable).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
    expect(pools.disable).not.toHaveBeenCalled();
  });
});
