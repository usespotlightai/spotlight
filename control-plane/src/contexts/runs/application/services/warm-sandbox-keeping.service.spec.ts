import type { WarmSandboxKeepingPort } from '@runs/application/ports/warm-sandbox-keeping.port';
import { WarmSandboxKeeping } from '@runs/application/services/warm-sandbox-keeping.service';
import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import { warmLineOf } from '@runs/domain/value-objects/warm-line.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-08T12:00:00.000Z');

const line = warmLineOf({ warm: 2 });

const keepingWith = (over: { requestFails?: boolean } = {}) => {
  const sandboxes = {
    kept: vi.fn(async () => [
      {
        id: 'sandbox_old',
        lineId: line.id,
        fingerprint: WarmFingerprint.of('outdated'),
        placed: true,
      },
    ]),
    linesLostSince: vi.fn(async () => []),
    request: vi.fn(async () => {
      if (over.requestFails) {
        throw new Error('runners down');
      }
    }),
    retire: vi.fn(async () => {}),
  } satisfies WarmSandboxKeepingPort;
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerPort;
  const keeping = new WarmSandboxKeeping(
    { keepingWarmSandboxes: async () => [line] },
    sandboxes,
    { now: () => NOW, sleep: async () => {} },
    logger,
  );

  return { keeping, sandboxes, logger };
};

describe('WarmSandboxKeeping', () => {
  it('retires the outdated warm sandboxes and requests the missing ones, backing off from lines lost in the last 15 minutes', async () => {
    const { keeping, sandboxes } = keepingWith();

    await keeping.keep();

    expect(sandboxes.linesLostSince).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 15 * 60_000),
    );
    expect(sandboxes.retire).toHaveBeenCalledWith('sandbox_old');
    expect(sandboxes.request).toHaveBeenCalledTimes(2);
    expect(sandboxes.request).toHaveBeenCalledWith(
      { line, fingerprint: WarmFingerprint.ofSetup(line) },
      NOW,
    );
  });

  it('goes on with the next request when one fails, and reports it', async () => {
    const { keeping, sandboxes, logger } = keepingWith({ requestFails: true });

    await keeping.keep();

    expect(sandboxes.request).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
