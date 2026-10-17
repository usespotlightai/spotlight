import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import type {
  ProvisionAnswer,
  ProvisionCall,
  ProvisionCallsPort,
} from '@runners/application/ports/provision-calls.port';
import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
import { Runners } from '@runners/application/services/runners.service';
import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import {
  anEgress,
  EGRESS_ID,
} from '@runners/domain/aggregates/egress.fake-spec';
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
  hashOf,
  heldHosts,
  POOL_ID,
  STARTED_AT,
  secretOf,
  TRUST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { ProvisionSecretUnopenableError } from '@runners/domain/exceptions/provision-secret-unopenable.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const CLAIM_BY = new Date(STARTED_AT.getTime() + 60_000);

const THROUGH_POOL = { kind: 'pool' as const, id: POOL_ID.value };

const THROUGH_TRUST = { kind: 'trust' as const, id: TRUST_ID.value };

const HOST = HOST_ID.value;

const IMAGE = 'ghcr.io/acme/runner:main';

const PLATFORM: PlatformEgressSettings = {
  url: EgressUrl.of('https://egress.usespotlight.ai'),
  tokenHash: hashOf('7'),
};

const running = (
  pool: RunnerPool | null,
  given: {
    standing?: readonly Runner[];
    held?: Runner | null;
    answer?: ProvisionAnswer;
    unsaved?: Error;
    trust?: RunnerTrust | null;
    host?: RunnerHost | null;
    unopenable?: boolean;
    insecureAllowed?: boolean;
    egress?: Egress | null;
    platform?: PlatformEgressSettings | null;
  } = {},
) => {
  const known = given.host === undefined ? aHost() : given.host;
  const { hosts } = known ? heldHosts(known) : heldHosts();
  const added: Runner[] = [];
  const logged: unknown[] = [];
  const saved: Runner[] = [];
  const called: ProvisionCall[] = [];
  let minted = 0;
  const service = new Runners(
    {
      findForStart: vi.fn(async () => pool),
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
      find: vi.fn(async () => given.egress ?? null),
    } as unknown as EgressRepository,
    {
      call: vi.fn(async (call: ProvisionCall) => {
        called.push(call);
        return given.answer ?? { outcome: 'accepted' };
      }),
    } as ProvisionCallsPort,
    {
      sealed: vi.fn(),
      opened: vi.fn(async () => {
        if (given.unopenable) {
          throw new ProvisionSecretUnopenableError(POOL_ID.value);
        }
        return secretOf('s');
      }),
    } satisfies ProvisionSecretsPort,
    {
      insecureAllowed: given.insecureAllowed ?? false,
      platformEgress: given.platform ?? null,
    },
    {
      mint: () =>
        minted++ % 2 === 0
          ? { token: 'one-run-token', hash: 'c'.repeat(64) }
          : { token: 'egress-token', hash: 'e'.repeat(64) },
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
        egressToken: 'egress-token',
      });
      expect(added[0]?.terms.values).toEqual(['linux']);
      expect(added[0]?.running?.image.value).toBe(IMAGE);
      expect(added[0]?.running?.usual).toBe(true);
      expect(added[0]?.installed[0]?.version?.value).toBe('2.1.0');
      expect(added[0]?.admission.equals(Admission.through(POOL_ID))).toBe(true);
      expect(added[0]?.hostId?.value).toBe(HOST);
      expect(added[0]?.tokenHash.value).toBe('c'.repeat(64));
      expect(added[0]?.egressTokenHash?.value).toBe('e'.repeat(64));
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

  describe('saying whether a host reports through a way in', () => {
    it('says so for a host that reported through that pool', async () => {
      await expect(
        running(aPullPool()).service.reports(THROUGH_POOL, HOST),
      ).resolves.toBe(true);
    });

    it('says not for a host that never reported, or through another way in', async () => {
      await expect(
        running(aPullPool(), { host: null }).service.reports(
          THROUGH_POOL,
          HOST,
        ),
      ).resolves.toBe(false);
      await expect(
        running(aPullPool()).service.reports(THROUGH_TRUST, HOST),
      ).resolves.toBe(false);
    });

    it('says not for a name no host could have', async () => {
      await expect(
        running(aPullPool()).service.reports(THROUGH_POOL, 'x'),
      ).resolves.toBe(false);
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
        egressToken: 'egress-token',
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
      needsEgress: false,
      claimBy: CLAIM_BY,
    };

    it('fails as unusable, calling nobody, when a run that needs egress meets a pool that names none', async () => {
      const { service, saved, called } = running(aPushPool());

      await expect(
        service.provision({ ...request, needsEgress: true }, STARTED_AT),
      ).resolves.toMatchObject({ outcome: 'failed', kind: 'unusable' });
      expect(called).toEqual([]);
      expect(saved[0]?.isDiscarded).toBe(true);
    });

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
      expect(added[0]?.egressTokenHash).toBeNull();
      expect(added[0]?.proxyCredentialHash).toBeNull();
      expect(called[0]?.egress).toBeNull();
    });

    it('gives the runner a proxy credential for the egress its pool names, and sends it with the egress URL', async () => {
      const { service, added, called } = running(
        aPushPool({ egress: EgressReference.to(EGRESS_ID) }),
        { egress: anEgress() },
      );

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'provisioned',
      });
      expect(added[0]?.proxyCredentialHash?.equals(hashOf('e'))).toBe(true);
      expect(called[0]?.egress).toEqual({
        url: 'https://egress.example.com',
        credential: 'egress-token',
        traffic: 'all',
      });
      expect(called[0]?.token).toBe('one-run-token');
    });

    it('sends whether the pool sends all traffic or only bound traffic through its egress', async () => {
      const { service, called } = running(
        aPushPool({
          egress: EgressReference.to(EGRESS_ID),
          egressTraffic: EgressTraffic.of('bound'),
        }),
        { egress: anEgress() },
      );

      await service.provision(request, STARTED_AT);

      expect(called[0]?.egress?.traffic).toBe('bound');
    });

    it('sends the platform egress URL when the pool names spotlight', async () => {
      const { service, called } = running(
        aPushPool({ egress: EgressReference.platform() }),
        { platform: PLATFORM },
      );

      await service.provision(request, STARTED_AT);

      expect(called[0]?.egress).toEqual({
        url: 'https://egress.usespotlight.ai',
        credential: 'egress-token',
        traffic: 'all',
      });
    });

    it('fails as unusable, calling nobody and letting the runner go, when the egress the pool names is not there', async () => {
      for (const given of [
        { egress: null },
        { egress: anEgress({ workspaceId: WorkspaceId.of('ws_other') }) },
      ]) {
        const { service, saved, called } = running(
          aPushPool({ egress: EgressReference.to(EGRESS_ID) }),
          given,
        );

        await expect(
          service.provision(request, STARTED_AT),
        ).resolves.toMatchObject({ outcome: 'failed', kind: 'unusable' });
        expect(called).toEqual([]);
        expect(saved[0]?.isDiscarded).toBe(true);
      }

      const platformless = running(
        aPushPool({ egress: EgressReference.platform() }),
      );

      await expect(
        platformless.service.provision(request, STARTED_AT),
      ).resolves.toMatchObject({ outcome: 'failed', kind: 'unusable' });
      expect(platformless.called).toEqual([]);
    });

    it('never sends a proxy credential toward an egress in the clear unless the deployment allows it', async () => {
      const pool = aPushPool({ egress: EgressReference.to(EGRESS_ID) });
      const egress = anEgress({ url: 'http://egress.example.com' });
      const refusing = running(pool, { egress });

      await expect(
        refusing.service.provision(request, STARTED_AT),
      ).resolves.toMatchObject({ outcome: 'failed', kind: 'not-allowed' });
      expect(refusing.called).toEqual([]);

      await expect(
        running(pool, { egress, insecureAllowed: true }).service.provision(
          request,
          STARTED_AT,
        ),
      ).resolves.toEqual({ outcome: 'provisioned' });
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
        answer: { outcome: 'refused', detail: 'Provision URL answered 500.' },
      });

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'failed',
        kind: 'refused',
        detail: 'Provision URL answered 500.',
      });
      expect(saved[0]?.isDiscarded).toBe(true);
    });

    it('still says why provision failed when letting the runner go fails, and logs it', async () => {
      const lost = new Error('the database is down');
      const { service, logged } = running(aPushPool(), {
        answer: { outcome: 'refused', detail: 'Provision URL answered 500.' },
        unsaved: lost,
      });

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'failed',
        kind: 'refused',
        detail: 'Provision URL answered 500.',
      });
      expect(logged).toEqual([{ err: lost, runner: 'pooled_1' }]);
    });

    it('signs the call with the pool’s secret, opened only to provision', async () => {
      const { service, called } = running(aPushPool());

      await service.provision(request, STARTED_AT);

      expect(called[0]?.secret.equals(secretOf('s'))).toBe(true);
    });

    it('fails as unusable, calling nobody and letting the runner go, when the pool’s secret does not open here', async () => {
      const { service, saved, called } = running(aPushPool(), {
        unopenable: true,
      });

      await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
        outcome: 'failed',
        kind: 'unusable',
        detail: 'Provision secret doesn’t open with this deployment’s keys.',
      });
      expect(called).toEqual([]);
      expect(saved[0]?.isDiscarded).toBe(true);
    });

    it('never sends a one-run token in the clear unless the deployment allows it', async () => {
      const clear = aPushPool({ url: 'http://provision.example.com/runs' });
      const refusing = running(clear);

      await expect(
        refusing.service.provision(request, STARTED_AT),
      ).resolves.toMatchObject({ outcome: 'failed', kind: 'not-allowed' });
      expect(refusing.called).toEqual([]);
      expect(refusing.saved[0]?.isDiscarded).toBe(true);

      const allowing = running(clear, { insecureAllowed: true });

      await expect(
        allowing.service.provision(request, STARTED_AT),
      ).resolves.toEqual({ outcome: 'provisioned' });
    });

    it('provisions nothing for a pool that is gone, or that is pulled from', async () => {
      for (const pool of [null, aPullPool()]) {
        const { service, added, called } = running(pool);

        await expect(service.provision(request, STARTED_AT)).resolves.toEqual({
          outcome: 'gone',
        });
        expect(added).toEqual([]);
        expect(called).toEqual([]);
      }
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
