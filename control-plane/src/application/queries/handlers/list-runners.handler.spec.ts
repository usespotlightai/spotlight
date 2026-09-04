import type { ClockPort } from '@application/ports/clock.port';
import type {
  RunnerReaderPort,
  RunnerSummary,
} from '@application/ports/runner-reader.port';
import { ListRunnersHandler } from '@application/queries/handlers/list-runners.handler';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-24T12:00:00.000Z');

const summary = (overrides: Partial<RunnerSummary> = {}): RunnerSummary => ({
  id: 'runner_1',
  name: 'Build server',
  harnesses: ['claude-code'],
  registeredAt: new Date('2026-08-24T11:00:00.000Z'),
  lastSeenAt: NOW,
  revokedAt: null,
  currentRun: null,
  ...overrides,
});

const clock = (): ClockPort => ({
  now: () => NOW,
  sleep: vi.fn().mockResolvedValue(undefined),
});

const reader = (result: RunnerSummary[]): RunnerReaderPort => ({
  listAll: vi.fn().mockResolvedValue(result),
  anyConnected: vi
    .fn()
    .mockResolvedValue(
      result.some((each) => !each.revokedAt && each.lastSeenAt !== null),
    ),
});

const handle = (runners: RunnerSummary[]) =>
  new ListRunnersHandler(reader(runners), clock()).execute();

describe('ListRunnersHandler', () => {
  it('reports a runner heard from just now as connected', async () => {
    const [only] = await handle([summary()]);

    expect(only).toMatchObject({
      id: 'runner_1',
      harnesses: ['claude-code'],
      connected: true,
      currentRun: null,
    });
  });

  it('still lists a runner that has gone quiet, marked disconnected', async () => {
    const quiet = new Date(NOW.getTime() - 60_000);

    await expect(handle([summary({ lastSeenAt: quiet })])).resolves.toEqual([
      expect.objectContaining({ connected: false }),
    ]);
  });

  it('holds a runner connected across a missed heartbeat', async () => {
    const recent = new Date(NOW.getTime() - 20_000);

    await expect(handle([summary({ lastSeenAt: recent })])).resolves.toEqual([
      expect.objectContaining({ connected: true }),
    ]);
  });

  it('says which run a busy runner is working on', async () => {
    const busy = summary({
      currentRun: { id: 'run_7', state: 'claimed' },
    });

    await expect(handle([busy])).resolves.toEqual([
      expect.objectContaining({
        currentRun: { id: 'run_7', state: 'claimed' },
      }),
    ]);
  });

  it('answers an empty fleet with an empty list rather than absence', async () => {
    await expect(handle([])).resolves.toEqual([]);
  });

  it('does not call a runner that has never checked in connected', async () => {
    const [never] = await handle([summary({ lastSeenAt: null })]);

    expect(never.connected).toBe(false);
  });

  it('does not call a revoked runner connected', async () => {
    const [revoked] = await handle([summary({ revokedAt: NOW })]);

    expect(revoked.connected).toBe(false);
  });
});
