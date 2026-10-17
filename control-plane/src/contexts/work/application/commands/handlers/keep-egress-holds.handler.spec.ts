import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { KeepEgressHoldsCommand } from '@work/application/commands/egress.commands';
import {
  holding,
  NOW,
  runOf,
  SHARED_TOKEN,
  sharedEgress,
} from '@work/application/commands/handlers/egress-handlers.fake-spec';
import {
  KeepEgressHoldsHandler,
  MAX_HOLDS_AT_ONCE,
} from '@work/application/commands/handlers/keep-egress-holds.handler';
import type { EgressRedemptions } from '@work/application/services/egress-redemptions.service';
import { describe, expect, it } from 'vitest';

const keeping = (
  admitted: Record<string, ReturnType<typeof runOf>[1]>,
  held: readonly string[],
) =>
  new KeepEgressHoldsHandler(
    sharedEgress(admitted),
    holding(held) as unknown as EgressRedemptions,
    { now: () => NOW } as ClockPort,
  );

describe('KeepEgressHoldsHandler', () => {
  it('answers the credentials whose runner still holds its run, or holds no run yet', async () => {
    const handler = keeping(
      Object.fromEntries([
        runOf('held', 'run_1'),
        runOf('ended', 'run_2'),
        runOf('waiting', 'run_3', null),
        runOf('checking', 'run_4', { kind: 'check', id: 'stack_1' }),
      ]),
      ['run_1'],
    );

    await expect(
      handler.execute(
        new KeepEgressHoldsCommand(SHARED_TOKEN, [
          'held',
          'ended',
          'waiting',
          'checking',
          'unknown',
          'held',
        ]),
      ),
    ).resolves.toEqual({
      outcome: 'kept',
      held: ['held', 'waiting', 'checking'],
    });
  });

  it('refuses an unknown egress token', async () => {
    await expect(
      keeping({}, []).execute(new KeepEgressHoldsCommand('other', ['held'])),
    ).resolves.toEqual({ outcome: 'refused' });
  });

  it('refuses more credentials than it allows at once, so egress sends them in batches', async () => {
    const many = Array.from(
      { length: MAX_HOLDS_AT_ONCE + 1 },
      (_, at) => `credential_${at}`,
    );

    await expect(
      keeping({}, []).execute(new KeepEgressHoldsCommand(SHARED_TOKEN, many)),
    ).resolves.toEqual({ outcome: 'too-many', max: MAX_HOLDS_AT_ONCE });
  });
});
