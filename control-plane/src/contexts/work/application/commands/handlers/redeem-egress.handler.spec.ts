import type {
  EgressFor,
  RunnerEgressPort,
} from '@runners/application/ports/runner-egress.port';
import type { RunRedemption } from '@secrets/application/contracts/run-redemption.contract';
import type { RunRedemptionsPort } from '@secrets/application/ports/run-redemptions.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RedeemEgressCommand } from '@work/application/commands/egress.commands';
import { RedeemEgressHandler } from '@work/application/commands/handlers/redeem-egress.handler';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-25T12:00:00.000Z');

const RUNNER = 'runner_1';

const REDEEMED = {
  secrets: [
    {
      secret: 'LINEAR_API_KEY',
      host: 'mcp.linear.app',
      header: 'authorization',
      prefix: 'Bearer ',
      sealed: 'v1.sealed',
      readInNetwork: null,
    },
  ],
  withheld: [{ secret: 'GONE', reason: 'no such secret' }],
};

const heldRun = (workspace = 'ws_1', by = RUNNER) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of(workspace),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
      wears: ['LINEAR_API_KEY', 'GONE'],
    }),
  }).claim(RunnerId.of(by), NOW);

const redeeming = (
  admitted: EgressFor | null,
  run: Run | null = heldRun(),
  after: Run | null = run,
) => {
  const asked: RunRedemption[] = [];
  const revoked: string[] = [];
  const found = [run, after];
  const handler = new RedeemEgressHandler(
    {
      admit: async (token) => (token === 'egress-token' ? admitted : null),
    } as RunnerEgressPort,
    {
      findById: async () =>
        (found.length > 1 ? found.shift() : found[0]) ?? null,
    } as unknown as RunRepository,
    {
      redeem: async (redemption) => {
        asked.push(redemption);
        return REDEEMED;
      },
    } as RunRedemptionsPort,
    {
      endedFor: async (runId: string) => {
        revoked.push(runId);
      },
    },
    { hosts: () => ['storage.example.com'] },
    { now: () => NOW } as ClockPort,
  );

  return { handler, asked, revoked };
};

const HOLDING_RUN: EgressFor = {
  runnerId: RUNNER,
  workspaceId: 'ws_1',
  work: { kind: 'run', id: 'run_1' },
};

describe('RedeemEgressHandler', () => {
  it('redeems the secrets the held run wears, for the recipient egress named', async () => {
    const { handler, asked } = redeeming(HOLDING_RUN);

    await expect(
      handler.execute(new RedeemEgressCommand('egress-token', 'recipient-key')),
    ).resolves.toEqual({
      outcome: 'redeemed',
      runId: 'run_1',
      reaches: ['storage.example.com'],
      ...REDEEMED,
    });
    expect(asked).toEqual([
      {
        workspaceId: 'ws_1',
        runId: 'run_1',
        wears: ['LINEAR_API_KEY', 'GONE'],
        recipient: 'recipient-key',
      },
    ]);
  });

  it('refuses a token that admits no egress', async () => {
    const { handler, asked } = redeeming(HOLDING_RUN);

    await expect(
      handler.execute(new RedeemEgressCommand('other', 'recipient-key')),
    ).resolves.toEqual({ outcome: 'refused' });
    expect(asked).toEqual([]);
  });

  it('gives a check only what every sandbox reaches', async () => {
    const { handler, asked } = redeeming({
      ...HOLDING_RUN,
      work: { kind: 'check', id: 'stack_1' },
    });

    await expect(
      handler.execute(new RedeemEgressCommand('egress-token', 'recipient-key')),
    ).resolves.toEqual({
      outcome: 'redeemed',
      runId: null,
      reaches: ['storage.example.com'],
      secrets: [],
      withheld: [],
    });
    expect(asked).toEqual([]);
  });

  it('redeems nothing for a run another runner holds, or one in another workspace', async () => {
    for (const run of [heldRun('ws_1', 'runner_2'), heldRun('ws_2'), null]) {
      const { handler, asked } = redeeming(HOLDING_RUN, run);

      await expect(
        handler.execute(
          new RedeemEgressCommand('egress-token', 'recipient-key'),
        ),
      ).resolves.toMatchObject({ outcome: 'redeemed', secrets: [] });
      expect(asked).toEqual([]);
    }
  });

  it('takes back what it granted when the run ends while it redeems', async () => {
    const ended = heldRun().complete(
      RunnerId.of(RUNNER),
      RunOutcome.of({ exitCode: 0, failed: false }),
    );
    const { handler, asked, revoked } = redeeming(
      HOLDING_RUN,
      heldRun(),
      ended,
    );

    await expect(
      handler.execute(new RedeemEgressCommand('egress-token', 'recipient-key')),
    ).resolves.toMatchObject({ outcome: 'redeemed', runId: null, secrets: [] });
    expect(asked).toHaveLength(1);
    expect(revoked).toEqual(['run_1']);
  });
});
