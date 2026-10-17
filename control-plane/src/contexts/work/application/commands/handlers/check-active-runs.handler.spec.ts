import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { CheckActiveRunsCommand } from '@work/application/commands/egress.commands';
import {
  CheckActiveRunsHandler,
  MAX_RUNS_AT_ONCE,
} from '@work/application/commands/handlers/check-active-runs.handler';
import {
  leasing,
  NOW,
  runOf,
  SHARED_TOKEN,
  sharedEgress,
} from '@work/application/commands/handlers/egress-handlers.fake-spec';
import type { EgressSecretFetches } from '@work/application/services/egress-secret-fetches.service';
import { describe, expect, it } from 'vitest';

const checker = (
  authorized: Record<string, ReturnType<typeof runOf>[1]>,
  leased: readonly string[],
) =>
  new CheckActiveRunsHandler(
    sharedEgress(authorized),
    leasing(leased) as unknown as EgressSecretFetches,
    { now: () => NOW } as ClockPort,
  );

describe('CheckActiveRunsHandler', () => {
  it('answers the credentials whose runner still leases its run, or has no run yet', async () => {
    const handler = checker(
      Object.fromEntries([
        runOf('leased', 'run_1'),
        runOf('ended', 'run_2'),
        runOf('waiting', 'run_3', null),
        runOf('checking', 'run_4', { kind: 'check', id: 'stack_1' }),
      ]),
      ['run_1'],
    );

    await expect(
      handler.execute(
        new CheckActiveRunsCommand(SHARED_TOKEN, [
          'leased',
          'ended',
          'waiting',
          'checking',
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
      checker({}, []).execute(new CheckActiveRunsCommand('other', ['leased'])),
    ).resolves.toEqual({ outcome: 'unauthorized' });
  });

  it('rejects more credentials than it allows at once, so egress sends them in batches', async () => {
    const many = Array.from(
      { length: MAX_RUNS_AT_ONCE + 1 },
      (_, at) => `credential_${at}`,
    );

    await expect(
      checker({}, []).execute(new CheckActiveRunsCommand(SHARED_TOKEN, many)),
    ).resolves.toEqual({ outcome: 'too-many', max: MAX_RUNS_AT_ONCE });
  });
});
