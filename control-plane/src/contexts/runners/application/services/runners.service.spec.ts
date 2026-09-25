import type {
  ProvisionAnswer,
  ProvisionCall,
  ProvisionCallsPort,
} from '@runners/application/ports/provision-calls.port';
import { Runners } from '@runners/application/services/runners.service';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aHost,
  aPullPool,
  aPushPool,
  aRunner,
  aTrust,
  HOST_ID,
  heldHosts,
  POOL_ID,
  STARTED_AT,
  TRUST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { ProvisionSecretUnopenableError } from '@runners/domain/exceptions/provision-secret-unopenable.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { describe, expect, it, vi } from 'vitest';

const CLAIM_BY = new Date(STARTED_AT.getTime() + 60_000);

const THROUGH_POOL = { kind: 'pool' as const, id: POOL_ID.value };

const THROUGH_TRUST = { kind: 'trust' as const, id: TRUST_ID.value };

const HOST = HOST_ID.value;

const IMAGE = 'ghcr.io/acme/runner:main';

const running = (
  pool: RunnerPool | Error | null,
  given: {
    standing?: readonly Runner[];
    held?: Runner | null;
    answer?: ProvisionAnswer;
    unsaved?: Error;
    trust?: RunnerTrust | null;
    host?: RunnerHost | null;
  } = {},
) => {
  const known = given.host === undefined ? aHost() : given.host;
  const { hosts } = known ? heldHosts(known) : heldHosts();
  const added: Runner[] = [];
  const logged: unknown[] = [];
  const saved: Runner[] = [];
  const called: ProvisionCall[] = [];
  const service = new Runners(
    {
      findForStart: vi.fn(async () => {
        if (pool instanceof Error) {
          throw pool;
        }
        return pool;
      }),
    } as unknown as RunnerPoolRepository,
    {
      find: vi.fn(async () => given.trust ?? null),
    } as unknown as RunnerTrustRepository,
    hosts,
    {
      standingIn: vi.fn(async () => given.standing ?? []),
      add: vi.fn(async (runner: Runner) => {
        added.push(runner);
      }),
      find: vi.fn(async () => given.held ?? added[added.length - 1] ?? null),
      save: vi.fn(async (runner: Runner) => {
        if (given.unsaved) {
          throw given.unsaved;
        }
        saved.push(runner);
      }),
      holding: vi.fn(async () => (given.held ? [given.held] : [])),
    } as unknown as RunnerRepository,
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

  return { service, added, saved, called, logged, hosts };
};

describe('Runners', () => {
  describe('starting a runner for a pull pool', () => {
    it('starts one, answering its one-run token once', async () => {
      const { service, added } = running(aPullPool());

      await expect(
        service.start(THROUGH_POOL, HOST, IMAGE, STARTED_AT, CLAIM_BY),
      ).resolves.toEqual({
        outcome: 'started',
        runnerId: RunnerId.of('pooled_9'),
        token: 'one-run-token',
      });
      expect(added[0]?.terms.values).toEqual(['linux']);
      expect(added[0]?.running?.image.value).toBe(IMAGE);
      expect(added[0]?.running?.usual).toBe(true);
      expect(added[0]?.installed[0]?.version?.value).toBe('2.1.0');
      expect(added[0]?.admission.equals(Admission.through(POOL_ID))).toBe(true);
      expect(added[0]?.hostId?.value).toBe(HOST);
    });

    it('starts one that takes only work asking for the image it runs', async () => {
      const { service, added } = running(aPullPool());

      await service.start(
        THROUGH_POOL,
        HOST,
        'ghcr.io/acme/widgets:1',
        STARTED_AT,
        CLAIM_BY,
      );

      const terms = added[0]?.terms;

      expect(terms?.serves(RunnerImage.of('ghcr.io/acme/widgets:1'))).toBe(
        true,
      );
      expect(terms?.serves(RunnerImage.of(IMAGE))).toBe(false);
      expect(terms?.serves(null)).toBe(false);
    });

    it('starts none for an image the host did not report serving', async () => {
      for (const image of ['ghcr.io/acme/elsewhere:1', 'ghcr.io/acme/old:1']) {
        const { service, added } = running(aPullPool());

        await expect(
          service.start(THROUGH_POOL, HOST, image, STARTED_AT, CLAIM_BY),
        ).resolves.toEqual({ outcome: 'unoffered' });
        expect(added).toEqual([]);
      }
    });

    it('starts none past maxRuns', async () => {
      const { service, added } = running(aPullPool({ maxRuns: 1 }), {
        standing: [aRunner()],
      });

      await expect(
        service.start(THROUGH_POOL, HOST, IMAGE, STARTED_AT, CLAIM_BY),
      ).resolves.toEqual({ outcome: 'full' });
      expect(added).toEqual([]);
    });

    it('starts none for a pool that is gone, or that provisions instead', async () => {
      await expect(
        running(null).service.start(
          THROUGH_POOL,
          HOST,
          IMAGE,
          STARTED_AT,
          CLAIM_BY,
        ),
      ).resolves.toEqual({ outcome: 'gone' });
      await expect(
        running(aPushPool()).service.start(
          THROUGH_POOL,
          HOST,
          IMAGE,
          STARTED_AT,
          CLAIM_BY,
        ),
      ).resolves.toEqual({ outcome: 'gone' });
    });
  });

  describe('starting a runner for a host', () => {
    it('starts none for a host that never reported', async () => {
      const { service, added } = running(aPullPool(), { host: null });

      await expect(
        service.start(THROUGH_POOL, HOST, IMAGE, STARTED_AT, CLAIM_BY),
      ).resolves.toEqual({ outcome: 'stranger' });
      expect(added).toEqual([]);
    });

    it('starts none for a host that reports through another way in', async () => {
      const { service, added } = running(aPullPool(), {
        trust: aTrust(),
        host: aHost({ through: aTrust() }),
      });

      await expect(
        service.start(THROUGH_POOL, HOST, IMAGE, STARTED_AT, CLAIM_BY),
      ).resolves.toEqual({ outcome: 'stranger' });
      await expect(
        running(aPullPool()).service.start(
          THROUGH_TRUST,
          HOST,
          IMAGE,
          STARTED_AT,
          CLAIM_BY,
        ),
      ).resolves.toEqual({ outcome: 'stranger' });
      expect(added).toEqual([]);
    });
  });

  describe('starting a runner through a trust', () => {
    it('starts one under the trust’s labels, answering its one-run token once', async () => {
      const { service, added } = running(null, {
        trust: aTrust(),
        host: aHost({ through: aTrust() }),
      });

      await expect(
        service.start(THROUGH_TRUST, HOST, IMAGE, STARTED_AT, CLAIM_BY),
      ).resolves.toEqual({
        outcome: 'started',
        runnerId: RunnerId.of('pooled_9'),
        token: 'one-run-token',
      });
      expect(added[0]?.terms.values).toEqual(['vpc-internal']);
      expect(added[0]?.terms.running?.image.value).toBe(IMAGE);
      expect(added[0]?.admission.equals(Admission.through(TRUST_ID))).toBe(
        true,
      );
    });

    it('starts one however many already stand, since a trust sets no maxRuns', async () => {
      const { service, added } = running(null, {
        trust: aTrust(),
        host: aHost({ through: aTrust() }),
        standing: [aRunner(), aRunner({ id: 'pooled_2' })],
      });

      await expect(
        service.start(THROUGH_TRUST, HOST, IMAGE, STARTED_AT, CLAIM_BY),
      ).resolves.toMatchObject({ outcome: 'started' });
      expect(added).toHaveLength(1);
    });

    it('starts none for a trust that is gone or withdrawn', async () => {
      await expect(
        running(null, {
          trust: null,
          host: aHost({ through: aTrust() }),
        }).service.start(THROUGH_TRUST, HOST, IMAGE, STARTED_AT, CLAIM_BY),
      ).resolves.toEqual({ outcome: 'gone' });
      await expect(
        running(null, {
          trust: aTrust().withdrawn(attributedIn()),
          host: aHost({ through: aTrust() }),
        }).service.start(THROUGH_TRUST, HOST, IMAGE, STARTED_AT, CLAIM_BY),
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
      image: 'ghcr.io/acme/widgets:1',
      claimBy: CLAIM_BY,
    };

    it('reserves a runner and calls provision with its one-run token', async () => {
      const { service, added, called } = running(aPushPool());

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'provisioned',
      });
      expect(added[0]?.id.value).toBe('pooled_1');
      expect(added[0]?.hostId).toBeNull();
      expect(called[0]).toMatchObject({
        attempt: 'pooled_1',
        pool: 'sandboxes',
        runId: 'run_1',
        image: 'ghcr.io/acme/widgets:1',
        token: 'one-run-token',
        claimBy: CLAIM_BY,
      });
      expect(added[0]?.running).toBeNull();
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
        standing: [aRunner()],
      });

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'full',
      });
      expect(called).toEqual([]);
    });
  });

  it('ends the runner holding work that ended', async () => {
    const held = aRunner().took(RunnerWork.run('run_1'), STARTED_AT);
    const { service, saved } = running(aPullPool(), { held });

    await service.workEnded({ kind: 'run', id: 'run_1' }, STARTED_AT);

    expect(saved[0]?.hasEnded).toBe(true);
  });

  it('records the work a runner took', async () => {
    const { service, saved } = running(aPullPool(), { held: aRunner() });

    await service.took(
      RunnerId.of('pooled_1'),
      { kind: 'check', id: 'stack_1' },
      STARTED_AT,
    );

    expect(saved[0]?.holds(RunnerWork.check('stack_1'))).toBe(true);
  });
});
