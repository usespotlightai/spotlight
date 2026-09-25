import type {
  ProvisionAnswer,
  ProvisionCall,
  ProvisionCallsPort,
} from '@runners/application/ports/provision-calls.port';
import { PoolRunners } from '@runners/application/services/pool-runners.service';
import type { PoolRunner } from '@runners/domain/aggregates/pool-runner.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPoolRunner,
  aPullPool,
  aPushPool,
  POOL_ID,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { ProvisionSecretUnopenableError } from '@runners/domain/exceptions/provision-secret-unopenable.error';
import type { PoolRunnerRepository } from '@runners/domain/repositories/pool-runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { PoolWork } from '@runners/domain/value-objects/pool-work.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it, vi } from 'vitest';

const CLAIM_BY = new Date(STARTED_AT.getTime() + 60_000);

const running = (
  pool: RunnerPool | Error | null,
  given: {
    standing?: readonly PoolRunner[];
    held?: PoolRunner | null;
    answer?: ProvisionAnswer;
    unsaved?: Error;
  } = {},
) => {
  const added: PoolRunner[] = [];
  const logged: unknown[] = [];
  const saved: PoolRunner[] = [];
  const called: ProvisionCall[] = [];
  const service = new PoolRunners(
    {
      findForStart: vi.fn(async () => {
        if (pool instanceof Error) {
          throw pool;
        }
        return pool;
      }),
    } as unknown as RunnerPoolRepository,
    {
      standingIn: vi.fn(async () => given.standing ?? []),
      add: vi.fn(async (runner: PoolRunner) => {
        added.push(runner);
      }),
      find: vi.fn(async () => given.held ?? added[added.length - 1] ?? null),
      save: vi.fn(async (runner: PoolRunner) => {
        if (given.unsaved) {
          throw given.unsaved;
        }
        saved.push(runner);
      }),
      holding: vi.fn(async () => (given.held ? [given.held] : [])),
    } as unknown as PoolRunnerRepository,
    {
      call: vi.fn(async (call: ProvisionCall) => {
        called.push(call);
        return given.answer ?? { outcome: 'accepted' };
      }),
    } as ProvisionCallsPort,
    {
      mint: () => ({ token: 'one-run-token', hash: 'c'.repeat(64) }),
      hash: () => 'c'.repeat(64),
    } as TokenMintPort,
    { generate: () => 'pooled_9' } as IdGeneratorPort,
    { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
    {
      error: (fields: unknown) => {
        logged.push(fields);
      },
    } as unknown as LoggerPort,
  );

  return { service, added, saved, called, logged };
};

describe('PoolRunners', () => {
  describe('starting a runner for a pull pool', () => {
    it('starts one, answering its one-run token once', async () => {
      const { service, added } = running(aPullPool());

      await expect(
        service.start(
          POOL_ID.value,
          [{ id: 'claude-code', models: [], version: '2.1.0' }],
          STARTED_AT,
          CLAIM_BY,
        ),
      ).resolves.toEqual({
        outcome: 'started',
        runnerId: RunnerId.of('pooled_9'),
        token: 'one-run-token',
      });
      expect(added[0]?.terms.values).toEqual(['linux', 'claude-code@2.1.0']);
    });

    it('starts none past maxRuns', async () => {
      const { service, added } = running(aPullPool({ maxRuns: 1 }), {
        standing: [aPoolRunner()],
      });

      await expect(
        service.start(POOL_ID.value, [], STARTED_AT, CLAIM_BY),
      ).resolves.toEqual({ outcome: 'full' });
      expect(added).toEqual([]);
    });

    it('starts none for a pool that is gone, or that provisions instead', async () => {
      await expect(
        running(null).service.start(POOL_ID.value, [], STARTED_AT, CLAIM_BY),
      ).resolves.toEqual({ outcome: 'gone' });
      await expect(
        running(aPushPool()).service.start(
          POOL_ID.value,
          [],
          STARTED_AT,
          CLAIM_BY,
        ),
      ).resolves.toEqual({ outcome: 'gone' });
    });
  });

  describe('provisioning a runner for a push pool', () => {
    const request = {
      poolId: POOL_ID.value,
      runnerId: RunnerId.of('pooled_1'),
      work: { kind: 'run' as const, id: 'run_1' },
      runId: 'run_1',
      taskId: 'task_1',
      labels: ['sandbox'],
      claimBy: CLAIM_BY,
    };

    it('reserves a runner and calls provision with its one-run token', async () => {
      const { service, added, called } = running(aPushPool());

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'provisioned',
      });
      expect(added[0]?.id.value).toBe('pooled_1');
      expect(called[0]).toMatchObject({
        attempt: 'pooled_1',
        pool: 'sandboxes',
        runId: 'run_1',
        token: 'one-run-token',
        claimBy: CLAIM_BY,
      });
    });

    it('names the change stack when the runner is provisioned for a check', async () => {
      const { service, called } = running(aPushPool());

      await service.provision(
        {
          ...request,
          work: { kind: 'check', id: 'stack_1' },
          taskId: null,
        },
        STARTED_AT,
      );

      expect(called[0]).toMatchObject({
        kind: 'check',
        stackId: 'stack_1',
        runId: 'run_1',
        taskId: null,
      });
    });

    it('names no change stack when the runner is provisioned for a run', async () => {
      const { service, called } = running(aPushPool());

      await service.provision(request, STARTED_AT);

      expect(called[0]).toMatchObject({ kind: 'run', stackId: null });
    });

    it('lets the runner go and says why when provision fails', async () => {
      const { service, saved } = running(aPushPool(), {
        answer: { outcome: 'refused', detail: 'answered 500' },
      });

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'failed',
        kind: 'refused',
        detail: 'answered 500',
      });
      expect(saved[0]?.isDiscarded).toBe(true);
    });

    it('still says why provision failed when letting the runner go fails, and logs it', async () => {
      const lost = new Error('the database is down');
      const { service, logged } = running(aPushPool(), {
        answer: { outcome: 'refused', detail: 'answered 500' },
        unsaved: lost,
      });

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'failed',
        kind: 'refused',
        detail: 'answered 500',
      });
      expect(logged).toEqual([{ err: lost, runner: 'pooled_1' }]);
    });

    it('fails as unusable when the pool’s secret does not open here', async () => {
      const { service, added, called } = running(
        new ProvisionSecretUnopenableError(POOL_ID.value),
      );

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'failed',
        kind: 'unusable',
        detail:
          'the pool’s provision secret does not open with this deployment’s keys',
      });
      expect(added).toEqual([]);
      expect(called).toEqual([]);
    });

    it('calls nobody when the pool is full', async () => {
      const { service, called } = running(aPushPool({ maxRuns: 1 }), {
        standing: [aPoolRunner()],
      });

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'full',
      });
      expect(called).toEqual([]);
    });
  });

  it('ends the runner holding work that ended', async () => {
    const held = aPoolRunner().took(PoolWork.run('run_1'), STARTED_AT);
    const { service, saved } = running(aPullPool(), { held });

    await service.workEnded({ kind: 'run', id: 'run_1' }, STARTED_AT);

    expect(saved[0]?.hasEnded).toBe(true);
  });

  it('records the work a runner took', async () => {
    const { service, saved } = running(aPullPool(), { held: aPoolRunner() });

    await service.took(
      RunnerId.of('pooled_1'),
      { kind: 'check', id: 'stack_1' },
      STARTED_AT,
    );

    expect(saved[0]?.holds(PoolWork.check('stack_1'))).toBe(true);
  });
});
