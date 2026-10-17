import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RecordEgressConnectionsCommand } from '@work/application/commands/egress.commands';
import {
  holding,
  NOW,
  runOf,
  SHARED_TOKEN,
  sharedEgress,
} from '@work/application/commands/handlers/egress-handlers.fake-spec';
import {
  MOST_CONNECTIONS_AT_ONCE,
  RecordEgressConnectionsHandler,
} from '@work/application/commands/handlers/record-egress-connections.handler';
import type { EgressConnectionRecord } from '@work/application/dto/egress-connections.dto';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';
import type { EgressRedemptions } from '@work/application/services/egress-redemptions.service';
import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import type { RunConnection } from '@work/domain/value-objects/run-connection.vo';
import { describe, expect, it } from 'vitest';

const record = (
  proxyCredential: string,
  over: Partial<EgressConnectionRecord> = {},
): EgressConnectionRecord => ({
  proxyCredential,
  host: 'registry.npmjs.org',
  port: 443,
  bytesOut: 100,
  bytesIn: 2_000,
  ms: 40,
  outcome: 'tunnelled',
  at: NOW.toISOString(),
  ...over,
});

const recording = () => {
  const kept: { run: string; attempt: number; host: string }[] = [];
  const taken: RunConnection[] = [];
  const connections: RunConnectionsPort = {
    record: async (attempt: RunAttempt, given: readonly RunConnection[]) => {
      taken.push(...given);
      kept.push(
        ...given.map((each) => ({
          run: attempt.runId.value,
          attempt: attempt.number,
          host: each.host,
        })),
      );
    },
    of: async () => [],
    wentWrongIn: async () => [],
    forgetBefore: async () => 0,
  };
  const handler = new RecordEgressConnectionsHandler(
    sharedEgress(
      {},
      Object.fromEntries([
        runOf('held', 'run_1'),
        runOf('ended', 'run_2'),
        runOf('waiting', 'run_3', null),
        runOf('lapsed', 'run_4'),
      ]),
    ),
    holding([], ['run_1', 'run_2']) as unknown as EgressRedemptions,
    connections,
    { now: () => NOW } as ClockPort,
  );

  return { handler, kept, taken };
};

describe('RecordEgressConnectionsHandler', () => {
  it('keeps each record with the run attempt its runner worked, also just after the run ended, and drops the rest', async () => {
    const { handler, kept } = recording();

    await expect(
      handler.execute(
        new RecordEgressConnectionsCommand(SHARED_TOKEN, [
          record('held'),
          record('held', { host: 'api.linear.app', outcome: 'forwarded' }),
          record('held', { port: 0 }),
          record('ended'),
          record('waiting'),
          record('lapsed'),
          record('unknown'),
        ]),
      ),
    ).resolves.toEqual({ outcome: 'recorded', recorded: 3, dropped: 4 });
    expect(kept).toEqual([
      { run: 'run_1', attempt: 1, host: 'registry.npmjs.org' },
      { run: 'run_1', attempt: 1, host: 'api.linear.app' },
      { run: 'run_2', attempt: 1, host: 'registry.npmjs.org' },
    ]);
  });

  it('keeps the status of a forwarded request and the reason egress gives', async () => {
    const { handler, taken } = recording();

    await handler.execute(
      new RecordEgressConnectionsCommand(SHARED_TOKEN, [
        record('held', { outcome: 'forwarded', status: 401 }),
        record('held', { outcome: 'blocked', reason: 'not-bound' }),
        record('held'),
      ]),
    );

    expect(
      taken.map(({ outcome, status, reason }) => ({ outcome, status, reason })),
    ).toEqual([
      { outcome: 'forwarded', status: 401, reason: null },
      { outcome: 'blocked', status: null, reason: 'not-bound' },
      { outcome: 'tunnelled', status: null, reason: null },
    ]);
  });

  it('refuses an unknown egress token', async () => {
    const { handler, kept } = recording();

    await expect(
      handler.execute(
        new RecordEgressConnectionsCommand('other', [record('held')]),
      ),
    ).resolves.toEqual({ outcome: 'refused' });
    expect(kept).toEqual([]);
  });

  it('refuses more records than it allows at once', async () => {
    const { handler, kept } = recording();

    await expect(
      handler.execute(
        new RecordEgressConnectionsCommand(
          SHARED_TOKEN,
          Array.from({ length: MOST_CONNECTIONS_AT_ONCE + 1 }, () =>
            record('held'),
          ),
        ),
      ),
    ).resolves.toEqual({ outcome: 'too-many', most: MOST_CONNECTIONS_AT_ONCE });
    expect(kept).toEqual([]);
  });
});
