import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import {
  DisablePlatformPoolCommand,
  EnablePlatformPoolCommand,
} from '@runners/application/commands/platform-pool.commands';
import type { PlatformPoolChangeDto } from '@runners/application/dto/platform-pool.dto';
import { AdminPlatformPoolController } from '@runners/presentation/http/controllers/admin-platform-pool.controller';
import { describe, expect, it } from 'vitest';

const answering = (answer: PlatformPoolChangeDto | null) => {
  const sent: unknown[] = [];
  const controller = new AdminPlatformPoolController({
    execute: async (command: unknown) => {
      sent.push(command);
      return answer;
    },
  } as unknown as CommandBus);

  return { controller, sent };
};

describe('AdminPlatformPoolController', () => {
  it('disables the platform pool, and says it is disabled', async () => {
    const { controller, sent } = answering({ outcome: 'disabled' });

    await expect(
      controller.setPlatformPool('ws_1', { enabled: false }),
    ).resolves.toEqual({ enabled: false });
    expect(sent[0]).toBeInstanceOf(DisablePlatformPoolCommand);
    expect(sent[0]).toEqual(new DisablePlatformPoolCommand('ws_1'));
  });

  it('enables the platform pool, and says it is enabled', async () => {
    const { controller, sent } = answering({ outcome: 'enabled' });

    await expect(
      controller.setPlatformPool('ws_1', { enabled: true }),
    ).resolves.toEqual({ enabled: true });
    expect(sent[0]).toBeInstanceOf(EnablePlatformPoolCommand);
  });

  it('refuses a body without enabled as true or false, sending nothing', async () => {
    const { controller, sent } = answering({ outcome: 'enabled' });

    await expect(
      controller.setPlatformPool('ws_1', {
        enabled: 'yes',
      } as unknown as { enabled: boolean }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.setPlatformPool('ws_1', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sent).toEqual([]);
  });

  it('finds no workspace that names none', async () => {
    await expect(
      answering(null).controller.setPlatformPool('ws_1', { enabled: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('says that the deployment adds no platform pool, or that the workspace has its own pool with its key', async () => {
    await expect(
      answering({ outcome: 'unset' }).controller.setPlatformPool('ws_1', {
        enabled: true,
      }),
    ).rejects.toThrow(
      new ConflictException(
        'Sorry, this deployment adds no platform pool to its workspaces. Set SPOTLIGHT_PLATFORM_POOL_URL and SPOTLIGHT_PLATFORM_POOL_SECRET to add one.',
      ),
    );
    await expect(
      answering({ outcome: 'key-taken' }).controller.setPlatformPool('ws_1', {
        enabled: false,
      }),
    ).rejects.toThrow(/its own runner pool with the key spotlight/);
  });
});
