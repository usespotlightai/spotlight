import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import { SetPlatformPoolCommand } from '@runners/application/commands/platform-pool.commands';
import type { PlatformPoolChangeDto } from '@runners/application/dto/platform-pool.dto';
import { AdminPlatformPoolController } from '@runners/presentation/http/controllers/admin-platform-pool.controller';
import { describe, expect, it } from 'vitest';

const NONE = { allowsSecrets: false, allowsReviewWork: false } as const;

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
  it('disables the platform pool, and says how it stands', async () => {
    const { controller, sent } = answering({ outcome: 'disabled', ...NONE });

    await expect(
      controller.setPlatformPool('ws_1', { enabled: false }),
    ).resolves.toEqual({
      enabled: false,
      allowsSecrets: false,
      allowsReviewWork: false,
    });
    expect(sent).toEqual([
      new SetPlatformPoolCommand('ws_1', { enabled: false }),
    ]);
  });

  it('sends one command for a body that enables the pool and allows it work, with only the fields it gives', async () => {
    const { controller, sent } = answering({
      outcome: 'enabled',
      allowsSecrets: false,
      allowsReviewWork: true,
    });

    await expect(
      controller.setPlatformPool('ws_1', {
        enabled: true,
        allowsReviewWork: true,
      }),
    ).resolves.toEqual({
      enabled: true,
      allowsSecrets: false,
      allowsReviewWork: true,
    });
    expect(sent).toEqual([
      new SetPlatformPoolCommand('ws_1', {
        enabled: true,
        allowsReviewWork: true,
      }),
    ]);
  });

  it('refuses a body that sets no field to true or false, sending nothing', async () => {
    const { controller, sent } = answering({ outcome: 'enabled', ...NONE });

    await expect(
      controller.setPlatformPool('ws_1', {
        enabled: 'yes',
      } as unknown as { enabled: boolean }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.setPlatformPool('ws_1', undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.setPlatformPool('ws_1', {
        allowsSecrets: 1,
      } as unknown as { allowsSecrets: boolean }),
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
