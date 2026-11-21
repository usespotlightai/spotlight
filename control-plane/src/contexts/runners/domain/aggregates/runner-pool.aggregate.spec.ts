import { EGRESS_ID } from '@runners/domain/aggregates/egress.fake-spec';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  anOwnPoolWithThePlatformKey,
  aPlatformPool,
  aPullPool,
  aPushPool,
  encryptedOf,
  hashOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerPoolCreated } from '@runners/domain/events/runner-pool-created.event';
import { RunnerPoolDeleted } from '@runners/domain/events/runner-pool-deleted.event';
import { RunnerPoolUpdated } from '@runners/domain/events/runner-pool-updated.event';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import { PlatformAccess } from '@runners/domain/value-objects/pool-access.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const BY = changeActorIn();

const definition = (key: string, labels: string[] = ['linux']) => ({
  key: PoolKey.of(key),
  labels: RunnerLabels.of(labels),
  maxRuns: null,
});

const changeOf = (pool: ReturnType<typeof aPullPool>) => {
  const [event] = pool.pullEvents();

  return event instanceof RunnerPoolUpdated ? event.change : null;
};

const occupied = (runners: number, idleSandboxes = 0): PoolOccupancy =>
  PoolOccupancy.of({
    entered: [],
    runners,
    idleSandboxes: Array.from({ length: idleSandboxes }, (_, index) =>
      SandboxId.of(`sandbox_${index}`),
    ),
  });

describe('RunnerPool', () => {
  it('serves a run that needs egress only when it names an egress', () => {
    const bare = aPushPool({ egress: null });
    const withEgress = aPushPool({
      egress: EgressReference.of(EGRESS_ID.value),
    });

    expect(bare.servesEgressNeed(false)).toBe(true);
    expect(bare.servesEgressNeed(true)).toBe(false);
    expect(withEgress.servesEgressNeed(true)).toBe(true);
  });

  it('is created as a change to the workspace’s configuration, naming its mode', () => {
    const [created] = aPullPool().pullEvents();

    expect(created).toBeInstanceOf(RunnerPoolCreated);
    expect((created as RunnerPoolCreated).change.detail?.recorded()).toEqual({
      mode: 'pull',
    });
  });

  it('pulls with a token, or pushes through provision with a secret', () => {
    const pulled = aPullPool();
    const pushed = aPushPool();

    expect(pulled.mode).toBe('pull');
    expect(pulled.tokenHash?.equals(hashOf('a'))).toBe(true);
    expect(pulled.provision).toBeNull();
    expect(pushed.mode).toBe('push');
    expect(pushed.tokenHash).toBeNull();
    expect(pushed.provision?.url.value).toBe(
      'https://provision.example.com/runs',
    );
  });

  it('will not provision without a secret to sign its calls with', () => {
    expect(() =>
      aPullPool().update(
        definition('ephemeral'),
        {
          mode: 'push',
          url: ProvisionUrl.of('https://provision.example.com/runs'),
          secret: null,
          secretVersion: null,
          egress: null,
        },
        BY,
      ),
    ).toThrow(ImmutableFieldError);
  });

  it('rotates its token in place, keeping its id', () => {
    const pool = aPullPool({ tokenVersion: 1 });
    pool.pullEvents();

    const rotated = pool.update(
      definition('ephemeral'),
      { mode: 'pull', tokenHash: hashOf('c'), tokenVersion: 2 },
      BY,
    );

    expect(rotated.id.equals(pool.id)).toBe(true);
    expect(rotated.tokenHash?.equals(hashOf('c'))).toBe(true);
    expect(changeOf(rotated)?.detail?.recorded()).toEqual({
      mode: 'pull',
      tokenRotated: true,
    });
  });

  it('requires a new token whenever its token version changes', () => {
    expect(() =>
      aPullPool({ tokenVersion: 1 }).update(
        definition('ephemeral'),
        { mode: 'pull', tokenHash: null, tokenVersion: 2 },
        BY,
      ),
    ).toThrow(InvalidRunnerPoolError);
  });

  it('keeps its token when relabelled without one', () => {
    const relabelled = aPullPool().update(
      definition('ephemeral', ['linux', 'gpu']),
      { mode: 'pull', tokenHash: null, tokenVersion: null },
      BY,
    );

    expect(relabelled.tokenHash?.equals(hashOf('a'))).toBe(true);
    expect(relabelled.labels.values).toEqual(['linux', 'gpu']);
  });

  it('keeps its key and its mode for its whole life', () => {
    expect(() =>
      aPullPool().update(
        definition('other'),
        { mode: 'pull', tokenHash: null, tokenVersion: null },
        BY,
      ),
    ).toThrow(ImmutableFieldError);
    expect(() =>
      aPushPool().update(
        definition('sandboxes'),
        { mode: 'pull', tokenHash: hashOf('c'), tokenVersion: null },
        BY,
      ),
    ).toThrow(ImmutableFieldError);
  });

  it('requires the secret again whenever its version changes', () => {
    const pool = aPushPool();
    const url = ProvisionUrl.of('https://provision.example.com/runs');
    pool.pullEvents();

    expect(() =>
      pool.update(
        definition('sandboxes'),
        { mode: 'push', url, secret: null, secretVersion: 2, egress: null },
        BY,
      ),
    ).toThrow(InvalidRunnerPoolError);

    const rotated = pool.update(
      definition('sandboxes'),
      {
        mode: 'push',
        url,
        secret: encryptedOf('t'),
        secretVersion: 2,
        egress: null,
      },
      BY,
    );

    expect(rotated.provision?.secret.equals(encryptedOf('t'))).toBe(true);
    expect(changeOf(rotated)?.detail?.recorded()).toEqual({
      mode: 'push',
      secretRotated: true,
    });
  });

  it('says how many more runs it has room for, none past maxRuns, and no bound without one', () => {
    const bounded = aPullPool({ maxRuns: 3 });

    expect(bounded.roomFor(occupied(1))).toBe(2);
    expect(bounded.roomFor(occupied(1, 1))).toBe(1);
    expect(bounded.roomFor(occupied(5))).toBe(0);
    expect(aPullPool().roomFor(occupied(10_000))).toBeNull();
    expect(aPullPool().delete(BY).roomFor(occupied(0))).toBe(0);
  });

  it('lets a runner start only in its own mode, while it is not deleted and has room', () => {
    const pulled = aPullPool({ maxRuns: 1 });

    expect(pulled.capacity('pull', occupied(0))).toBe('open');
    expect(pulled.capacity('pull', occupied(1))).toBe('full');
    expect(pulled.capacity('pull', occupied(0, 1))).toBe('full');
    expect(pulled.capacity('push', occupied(0))).toBe('gone');
    expect(aPushPool().capacity('push', occupied(0))).toBe('open');
    expect(aPushPool().capacity('pull', occupied(0))).toBe('gone');
    expect(pulled.delete(BY).capacity('pull', occupied(0))).toBe('gone');
  });

  it('gives a runner that enters an idle sandbox the slot of that sandbox', () => {
    const pulled = aPullPool({ maxRuns: 1 });
    const idle = occupied(0, 1);

    expect(
      pulled.capacity('pull', idle.entering(SandboxId.of('sandbox_0'))),
    ).toBe('open');
    expect(
      pulled.capacity('pull', idle.entering(SandboxId.of('sandbox_9'))),
    ).toBe('full');
  });

  it('always keeps its provision secret encrypted, even after an update without one', () => {
    const updated = aPushPool().update(
      definition('sandboxes'),
      {
        mode: 'push',
        url: ProvisionUrl.of('https://provision.example.com/v2'),
        secret: null,
        secretVersion: 1,
        egress: null,
      },
      BY,
    );

    expect(updated.provision?.secret.equals(encryptedOf('s'))).toBe(true);
    expect(updated.provision?.url.value).toBe(
      'https://provision.example.com/v2',
    );
  });

  it('records a deleted change when it is deleted', () => {
    const pool = aPullPool();
    pool.pullEvents();

    const [deleted] = pool.delete(BY).pullEvents();

    expect(deleted).toBeInstanceOf(RunnerPoolDeleted);
    expect((deleted as RunnerPoolDeleted).change.action).toBe('deleted');
  });

  it('rejects a write from a version that is no longer current', () => {
    expect(() => aPullPool().assertVersion(3)).toThrow(
      RunnerPoolVersionConflictError,
    );
  });

  it('takes a whole number of runs as its limit', () => {
    expect(() => MaxRuns.of(0)).toThrow(InvalidRunnerPoolError);
    expect(() => MaxRuns.of(1.5)).toThrow(InvalidRunnerPoolError);
    expect(MaxRuns.of(3).allows(2)).toBe(true);
  });
});

describe('RunnerPool egress', () => {
  it('names the egress its runners go out through, or none', () => {
    const platform = aPushPool({ egress: EgressReference.platform() });
    const shared = aPushPool({ egress: EgressReference.to(EGRESS_ID) });

    expect(platform.egress?.isPlatform).toBe(true);
    expect(platform.usesEgress(EgressReference.platform())).toBe(true);
    expect(platform.usesEgress(EgressReference.to(EGRESS_ID))).toBe(false);
    expect(shared.usesEgress(EgressReference.to(EGRESS_ID))).toBe(true);
    expect(aPushPool().egress).toBeNull();
    expect(aPullPool().egress).toBeNull();
    expect(aPullPool().usesEgress(EgressReference.platform())).toBe(false);
  });

  it('names another egress, or none, when it is updated', () => {
    const pool = aPushPool({ egress: EgressReference.platform() });
    const url = ProvisionUrl.of('https://provision.example.com/runs');
    const access = {
      mode: 'push' as const,
      url,
      secret: null,
      secretVersion: 1,
    };

    expect(
      pool
        .update(
          definition('sandboxes'),
          { ...access, egress: EgressReference.to(EGRESS_ID) },
          BY,
        )
        .egress?.equals(EgressReference.to(EGRESS_ID)),
    ).toBe(true);
    expect(
      pool.update(definition('sandboxes'), { ...access, egress: null }, BY)
        .egress,
    ).toBeNull();
  });

  it('goes out through nothing once deleted', () => {
    expect(
      aPushPool({ egress: EgressReference.platform() })
        .delete(BY)
        .usesEgress(EgressReference.platform()),
    ).toBe(false);
  });
});

describe('RunnerPool for the platform', () => {
  const recordedOf = (pool: RunnerPool) =>
    pool
      .pullEvents()
      .flatMap((each) =>
        each instanceof RunnerPoolUpdated ? [each.change.recordedDetail] : [],
      );

  it('is created with the platform key, no run limit and no provision URL or secret of its own', () => {
    const pool = aPlatformPool({ labels: ['linux'] });
    const [created] = pool.pullEvents();

    expect(pool.key.equals(PoolKey.platform())).toBe(true);
    expect(pool.isPlatform).toBe(true);
    expect(pool.access.kind).toBe('platform');
    expect(pool.maxRuns).toBeNull();
    expect(pool.provision).toBeNull();
    expect(pool.mode).toBe('push');
    expect(pool.roomFor(occupied(500))).toBeNull();
    expect(pool.capacity('push', occupied(500))).toBe('open');
    expect(created).toBeInstanceOf(RunnerPoolCreated);
  });

  it('provisions only while the deployment sets its provisioner, and a pool of the workspace provisions either way', () => {
    expect(aPlatformPool().canProvision(true)).toBe(true);
    expect(aPlatformPool().canProvision(false)).toBe(false);
    expect(aPushPool().canProvision(false)).toBe(true);
    expect(aPullPool().canProvision(true)).toBe(false);
  });

  it('keeps the platform key for the platform pool', () => {
    expect(() =>
      RunnerPool.create({
        id: PoolId.of('pool_2'),
        workspaceId: WorkspaceId.of('ws_1'),
        ...definition('spotlight'),
        access: { mode: 'pull', tokenHash: hashOf('a'), tokenVersion: null },
        by: BY,
      }),
    ).toThrow(InvalidRunnerPoolError);
    expect(anOwnPoolWithThePlatformKey().isPlatform).toBe(false);
  });

  it('is deleted only by Spotlight', () => {
    expect(() => aPlatformPool().delete(BY)).toThrow(InconsistentStateError);
    expect(
      aPlatformPool().delete(ChangeActor.spotlight(WorkspaceId.of('ws_1')))
        .isDeleted,
    ).toBe(true);
  });

  it('goes out through the egress the deployment names for it', () => {
    const pool = aPlatformPool({ egress: EgressReference.platform() });

    expect(pool.usesEgress(EgressReference.platform())).toBe(true);
    expect(pool.servesEgressNeed(true)).toBe(true);
    expect(pool.egressTraffic.value).toBe('all');
    expect(aPlatformPool().servesEgressNeed(true)).toBe(false);
  });

  it('takes the labels and egress the deployment sets now, and changes nothing when they are the same', () => {
    const pool = aPlatformPool({ labels: ['linux'] });
    pool.pullEvents();

    expect(
      pool.reconcile({ labels: RunnerLabels.of(['linux']), egress: null }, BY),
    ).toBe(pool);

    const reconciled = pool.reconcile(
      {
        labels: RunnerLabels.of(['linux', 'gpu']),
        egress: EgressReference.platform(),
      },
      BY,
    );

    expect(reconciled.labels.values).toEqual(['linux', 'gpu']);
    expect(reconciled.egress?.isPlatform).toBe(true);
    expect(recordedOf(reconciled)).toEqual([
      { mode: 'push', egressChanged: true },
    ]);
  });

  it('provisions nothing once disabled, and keeps disabled when the deployment changes its labels', () => {
    const disabled = aPlatformPool().disable(BY);

    expect(disabled.isDisabled).toBe(true);
    expect(disabled.canProvision(true)).toBe(false);
    expect(disabled.roomFor(occupied(0))).toBe(0);
    expect(disabled.capacity('push', occupied(0))).toBe('gone');
    expect(
      disabled.reconcile({ labels: RunnerLabels.of(['gpu']), egress: null }, BY)
        .isDisabled,
    ).toBe(true);
  });

  it('records each change to disabled or enabled, and nothing when it is already so', () => {
    const pool = aPlatformPool();
    pool.pullEvents();
    const disabled = pool.disable(BY);

    expect(recordedOf(disabled)).toEqual([{ mode: 'push', disabled: true }]);
    expect(disabled.disable(BY)).toBe(disabled);
    expect(recordedOf(disabled.enable(BY))).toEqual([
      { mode: 'push', disabled: false },
    ]);
  });

  it('refuses the changes of a workspace pool, and a workspace pool refuses the changes of the platform pool', () => {
    expect(() =>
      aPlatformPool().update(
        { key: PoolKey.platform(), labels: RunnerLabels.none(), maxRuns: null },
        { mode: 'pull', tokenHash: hashOf('a'), tokenVersion: null },
        BY,
      ),
    ).toThrow(InconsistentStateError);
    expect(() => aPushPool().disable(BY)).toThrow(InconsistentStateError);
    expect(() =>
      aPushPool().reconcile({ labels: RunnerLabels.none(), egress: null }, BY),
    ).toThrow(InconsistentStateError);
  });

  it('does not read back as the platform pool with another key or a run limit', () => {
    const stored = {
      id: PoolId.of('pool_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      labels: RunnerLabels.none(),
      access: PlatformAccess.of(null),
      version: 0,
    };

    expect(() =>
      RunnerPool.rehydrate({
        ...stored,
        key: PoolKey.of('sandboxes'),
        maxRuns: null,
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      RunnerPool.rehydrate({
        ...stored,
        key: PoolKey.platform(),
        maxRuns: MaxRuns.of(2),
      }),
    ).toThrow(InconsistentStateError);
  });

  it('reads back disabled from the access of the platform pool, the only access that can be disabled', () => {
    const pool = RunnerPool.rehydrate({
      id: PoolId.of('pool_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      key: PoolKey.platform(),
      labels: RunnerLabels.none(),
      maxRuns: null,
      access: PlatformAccess.of(null, true),
      version: 0,
    });

    expect(pool.isDisabled).toBe(true);
    expect(pool.mode).toBe('push');
    expect(aPushPool().isDisabled).toBe(false);
  });
});
