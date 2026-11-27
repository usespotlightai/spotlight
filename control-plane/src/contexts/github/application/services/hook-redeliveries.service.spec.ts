import type {
  AppHookDeliveriesPort,
  HookDeliveryAttempt,
} from '@github/application/ports/app-hook-deliveries.port';
import { HookRedeliveries } from '@github/application/services/hook-redeliveries.service';
import { MAX_REDELIVERIES } from '@github/domain/services/hook-redelivery-policy';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const START = new Date('2026-11-26T12:00:00Z');

const MINUTE_MS = 60_000;

const DAY_MS = 24 * 60 * MINUTE_MS;

const PAGE_SIZE = 3;

const FIRST_ID = 3_856_285_345_890_959_360n;

const newestFirst = (one: HookDeliveryAttempt, other: HookDeliveryAttempt) => {
  const [a, b] = [BigInt(one.id), BigInt(other.id)];

  return a > b ? -1 : a < b ? 1 : 0;
};

const fakeGitHub = () => {
  const attempts: HookDeliveryAttempt[] = [];
  const pages: (string | null)[] = [];
  let nextId = FIRST_ID;
  let refusing = new Set<string>();

  const port: AppHookDeliveriesPort = {
    page: vi.fn(async (cursor: string | null) => {
      pages.push(cursor);
      const listed = [...attempts].sort(newestFirst);
      const from = cursor !== null ? Number(cursor) : 0;

      return {
        attempts: listed.slice(from, from + PAGE_SIZE),
        next: from + PAGE_SIZE < listed.length ? `${from + PAGE_SIZE}` : null,
      };
    }),
    redeliver: vi.fn(async (attemptId: string) => {
      if (refusing.has(attemptId)) {
        throw new Error('GitHub did not answer');
      }
    }),
  };

  return {
    port,
    pages,
    attempt: (guid: string, statusCode: number | null, deliveredAt: Date) => {
      const attempt = { id: `${nextId}`, guid, statusCode, deliveredAt };
      nextId += 1n;
      attempts.push(attempt);

      return attempt;
    },
    refuse: (...ids: string[]) => {
      refusing = new Set(ids);
    },
  };
};

const setup = () => {
  let now = START;
  const github = fakeGitHub();
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies LoggerPort;
  const telemetry = telemetryInMemory();
  const redeliveries = new HookRedeliveries(
    github.port,
    { now: () => now, sleep: async () => {} },
    logger,
    telemetry,
  );

  return {
    redeliveries,
    github,
    logger,
    telemetry,
    later: (ms: number) => {
      now = new Date(now.getTime() + ms);
      return now;
    },
    now: () => now,
    ago: (ms: number) => new Date(now.getTime() - ms),
  };
};

describe('HookRedeliveries', () => {
  it('asks GitHub to redeliver a delivery that failed', async () => {
    const { redeliveries, github, ago } = setup();
    const failed = github.attempt('closed-10', 500, ago(2 * MINUTE_MS));

    await redeliveries.redeliver();

    expect(github.port.redeliver).toHaveBeenCalledExactlyOnceWith(failed.id);
  });

  it('leaves alone a delivery that has a successful attempt', async () => {
    const { redeliveries, github, ago } = setup();
    github.attempt('closed-13', 502, ago(5 * MINUTE_MS));
    github.attempt('closed-13', 200, ago(4 * MINUTE_MS));
    github.attempt('opened-14', 202, ago(3 * MINUTE_MS));

    await redeliveries.redeliver();

    expect(github.port.redeliver).not.toHaveBeenCalled();
  });

  it('redelivers the latest attempt and stops once one gets through', async () => {
    const { redeliveries, github, later, now } = setup();
    github.attempt('closed-18', 530, now());
    later(MINUTE_MS);
    await redeliveries.redeliver();

    const retried = github.attempt('closed-18', 500, now());
    later(2 * MINUTE_MS);
    await redeliveries.redeliver();

    expect(github.port.redeliver).toHaveBeenLastCalledWith(retried.id);

    github.attempt('closed-18', 200, now());
    later(60 * MINUTE_MS);
    await redeliveries.redeliver();

    expect(github.port.redeliver).toHaveBeenCalledTimes(2);
    expect(redeliveries.health().undelivered).toBe(0);
  });

  it('does not ask again while the redelivery it asked for is not listed yet', async () => {
    const { redeliveries, github, later, ago } = setup();
    github.attempt('closed-19', 500, ago(2 * MINUTE_MS));

    await redeliveries.redeliver();
    later(MINUTE_MS);
    await redeliveries.redeliver();

    expect(github.port.redeliver).toHaveBeenCalledTimes(1);
  });

  it('stops asking after the last redelivery', async () => {
    const { redeliveries, github, later, now, logger } = setup();
    github.attempt('closed-20', 500, now());

    for (let round = 0; round <= MAX_REDELIVERIES + 2; round += 1) {
      later(60 * MINUTE_MS);
      await redeliveries.redeliver();
      github.attempt('closed-20', 500, now());
    }

    expect(github.port.redeliver).toHaveBeenCalledTimes(MAX_REDELIVERIES);
    expect(logger.warn).toHaveBeenCalledWith(
      { guid: 'closed-20', attempts: MAX_REDELIVERIES + 1 },
      'Stopped asking GitHub to redeliver a failed webhook delivery',
    );
  });

  it('does not ask again for a delivery that Spotlight refused', async () => {
    const { redeliveries, github, ago } = setup();
    github.attempt('unsigned', 401, ago(5 * MINUTE_MS));

    await redeliveries.redeliver();

    expect(github.port.redeliver).not.toHaveBeenCalled();
  });

  it('reads no further back than GitHub keeps deliveries', async () => {
    const { redeliveries, github, ago } = setup();
    github.attempt('too-old', 500, ago(3 * DAY_MS + MINUTE_MS));
    const recent = github.attempt('recent', 500, ago(2 * DAY_MS));

    await redeliveries.redeliver();

    expect(github.port.redeliver).toHaveBeenCalledExactlyOnceWith(recent.id);
  });

  it('reads only the deliveries since the last check', async () => {
    const { redeliveries, github, later, ago } = setup();

    for (let each = 0; each < 3 * PAGE_SIZE; each += 1) {
      github.attempt(`old-${each}`, 200, ago(DAY_MS));
    }

    await redeliveries.redeliver();
    later(MINUTE_MS);
    github.attempt('new', 200, ago(0));
    github.pages.length = 0;
    await redeliveries.redeliver();

    expect(github.pages).toEqual([null]);
  });

  it('counts an attempt once while checks overlap', async () => {
    const { redeliveries, github, later, ago } = setup();
    github.attempt('closed-10', 500, ago(MINUTE_MS));

    await redeliveries.redeliver();
    later(MINUTE_MS);
    await redeliveries.redeliver();

    expect(redeliveries.health().failedLastHour).toBe(1);
  });

  it('asks for at most 20 redeliveries in one check, the oldest first', async () => {
    const { redeliveries, github, ago } = setup();

    const failed = Array.from({ length: 25 }, (_, each) =>
      github.attempt(`failed-${each}`, 500, ago((30 - each) * MINUTE_MS)),
    );

    await redeliveries.redeliver();

    expect(github.port.redeliver).toHaveBeenCalledTimes(20);
    expect(github.port.redeliver).toHaveBeenNthCalledWith(1, failed[0]?.id);
    expect(github.port.redeliver).toHaveBeenLastCalledWith(failed[19]?.id);
  });

  it('tells apart attempts whose ids differ past the precision of a JS number', async () => {
    const { redeliveries, github, ago } = setup();
    const first = github.attempt('closed-10', 500, ago(3 * MINUTE_MS));
    const second = github.attempt('closed-13', 500, ago(2 * MINUTE_MS));

    await redeliveries.redeliver();

    expect(Number(first.id)).toBe(Number(second.id));
    expect(vi.mocked(github.port.redeliver).mock.calls).toEqual([
      [first.id],
      [second.id],
    ]);
  });

  it('follows the attempt with the larger id when two share a second', async () => {
    const { redeliveries, github, now, later } = setup();
    github.attempt('closed-18', 500, now());
    const retried = github.attempt('closed-18', 500, now());
    later(2 * MINUTE_MS);

    await redeliveries.redeliver();

    expect(github.port.redeliver).toHaveBeenCalledExactlyOnceWith(retried.id);
  });

  it('asks for the others when GitHub does not take one request', async () => {
    const { redeliveries, github, ago, telemetry, logger } = setup();
    const first = github.attempt('closed-10', 500, ago(3 * MINUTE_MS));
    const second = github.attempt('closed-13', 500, ago(2 * MINUTE_MS));
    github.refuse(first.id);

    await redeliveries.redeliver();

    expect(github.port.redeliver).toHaveBeenLastCalledWith(second.id);
    expect(telemetry.counted).toEqual([
      {
        metric: 'spotlight.github.hook_redeliveries',
        attributes: { 'spotlight.github.redelivery.outcome': 'failed' },
      },
      {
        metric: 'spotlight.github.hook_redeliveries',
        attributes: { 'spotlight.github.redelivery.outcome': 'requested' },
      },
    ]);
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      { guids: ['closed-13'], failed: 1 },
      'Asked GitHub to redeliver failed webhook deliveries',
    );
  });

  it('does not tell it asked when GitHub took no request', async () => {
    const { redeliveries, github, ago, logger } = setup();
    const failed = github.attempt('closed-10', 500, ago(3 * MINUTE_MS));
    github.refuse(failed.id);

    await redeliveries.redeliver();

    expect(logger.info).not.toHaveBeenCalled();
  });

  it('tells how many deliveries failed in the last hour and how many are not delivered', async () => {
    const { redeliveries, github, ago } = setup();
    github.attempt('closed-10', 500, ago(2 * 60 * MINUTE_MS));
    github.attempt('closed-10', 500, ago(30 * MINUTE_MS));
    github.attempt('closed-13', 502, ago(20 * MINUTE_MS));
    github.attempt('closed-13', 200, ago(10 * MINUTE_MS));
    github.attempt('opened-14', 200, ago(5 * MINUTE_MS));

    await redeliveries.redeliver();

    expect(redeliveries.health()).toEqual({
      failedLastHour: 2,
      undelivered: 1,
    });
  });
});
