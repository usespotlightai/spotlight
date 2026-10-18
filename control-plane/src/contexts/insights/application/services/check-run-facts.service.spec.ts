import type {
  RunFactsDrift,
  RunFactsPort,
} from '@insights/application/ports/run-facts.port';
import { CheckRunFacts } from '@insights/application/services/check-run-facts.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { describe, expect, it, vi } from 'vitest';

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

const setUp = (drift: RunFactsDrift = { checked: 4, repaired: [] }) => {
  let now = new Date('2026-10-14T12:00:00Z');
  const facts: RunFactsPort = {
    repairEndedSince: vi.fn().mockResolvedValue(drift),
  };
  const logger: LoggerPort = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const check = new CheckRunFacts(
    facts,
    { now: () => now, sleep: vi.fn() },
    logger,
  );

  return {
    check,
    facts,
    logger,
    later: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
};

describe('CheckRunFacts', () => {
  it('checks the runs that ended in the last three days', async () => {
    const { check, facts } = setUp();

    await check.processDue();

    expect(facts.repairEndedSince).toHaveBeenCalledWith(
      new Date(new Date('2026-10-14T12:00:00Z').getTime() - 3 * DAY),
    );
  });

  it('checks again only after six hours', async () => {
    const { check, facts, later } = setUp();

    await check.processDue();
    later(5 * HOUR);
    await check.processDue();
    later(HOUR);
    await check.processDue();

    expect(facts.repairEndedSince).toHaveBeenCalledTimes(2);
  });

  it('says nothing when every fact matches its run', async () => {
    const { check, logger } = setUp();

    await check.processDue();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns with the repaired runs when facts had drifted', async () => {
    const { check, logger } = setUp({ checked: 9, repaired: ['r1', 'r2'] });

    await check.processDue();

    expect(logger.warn).toHaveBeenCalledWith(
      { checked: 9, repaired: 2, runIds: ['r1', 'r2'] },
      'Run facts had drifted from their runs and were repaired',
    );
  });
});
