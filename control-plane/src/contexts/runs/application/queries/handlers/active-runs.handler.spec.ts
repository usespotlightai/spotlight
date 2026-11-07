import {
  leasing,
  NOW,
  runOf,
  SHARED_TOKEN,
  sharedEgress,
} from '@runs/application/commands/handlers/egress-handlers.fake-spec';
import type { CheckWorkPort } from '@runs/application/ports/check-work.port';
import { ActiveRunsQuery } from '@runs/application/queries/egress.queries';
import {
  ActiveRunsHandler,
  MAX_RUNS_AT_ONCE,
} from '@runs/application/queries/handlers/active-runs.handler';
import type { EgressSecretFetches } from '@runs/application/services/egress-secret-fetches.service';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { describe, expect, it } from 'vitest';

const checker = (
  authorized: Record<string, ReturnType<typeof runOf>[1]>,
  leased: readonly string[],
  checksLeased: readonly string[] = [],
) =>
  new ActiveRunsHandler(
    sharedEgress(authorized),
    leasing(leased) as unknown as EgressSecretFetches,
    {
      isLeasedBy: async (stackId: string) => checksLeased.includes(stackId),
    } as unknown as CheckWorkPort,
    { now: () => NOW } as ClockPort,
  );

describe('ActiveRunsHandler', () => {
  it('answers the credentials whose runner still leases its run or check, or has no work yet', async () => {
    const handler = checker(
      Object.fromEntries([
        runOf('leased', 'run_1'),
        runOf('ended', 'run_2'),
        runOf('waiting', 'run_3', null),
        runOf('checking', 'run_4', { kind: 'check', id: 'stack_1' }),
        runOf('checked', 'run_5', { kind: 'check', id: 'stack_2' }),
      ]),
      ['run_1'],
      ['stack_1'],
    );

    await expect(
      handler.execute(
        new ActiveRunsQuery(SHARED_TOKEN, [
          'leased',
          'ended',
          'waiting',
          'checking',
          'checked',
          'unknown',
          'leased',
        ]),
      ),
    ).resolves.toEqual({
      outcome: 'checked',
      active: ['leased', 'waiting', 'checking'],
    });
  });

  it('rejects an unknown egress token', async () => {
    await expect(
      checker({}, []).execute(new ActiveRunsQuery('other', ['leased'])),
    ).resolves.toEqual({ outcome: 'unauthorized' });
  });

  it('rejects more credentials than it allows at once, so egress sends them in batches', async () => {
    const many = Array.from(
      { length: MAX_RUNS_AT_ONCE + 1 },
      (_, at) => `credential_${at}`,
    );

    await expect(
      checker({}, []).execute(new ActiveRunsQuery(SHARED_TOKEN, many)),
    ).resolves.toEqual({ outcome: 'too-many', max: MAX_RUNS_AT_ONCE });
  });
});
