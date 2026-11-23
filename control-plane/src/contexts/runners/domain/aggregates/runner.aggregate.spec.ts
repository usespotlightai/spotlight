import {
  aPlatformPool,
  aPullPool,
  aRunner,
  aTrust,
  POOL_ID,
  STARTED_AT,
  TRUST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerEnded } from '@runners/domain/events/runner-ended.event';
import { RunnerAlreadyClaimedError } from '@runners/domain/exceptions/runner-already-claimed.error';
import { RunnerEndedError } from '@runners/domain/exceptions/runner-ended.error';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { describe, expect, it } from 'vitest';

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const RUN = RunnerWork.run('run_1');

describe('Runner', () => {
  it('answers to its pool’s labels, not to the releases it reports', () => {
    const runner = aRunner({
      installed: [InstalledHarness.reported('claude-code', [], '2.1.0')],
    });

    expect(runner.offer.values).toEqual(['linux']);
  });

  it('serves only work that requests the image it runs, or for none when that image is the default one', () => {
    const widgets = RunnerImage.of('ghcr.io/acme/widgets:1');
    const gadgets = RunnerImage.of('ghcr.io/acme/gadgets:1');
    const runner = aRunner({ running: RunningImage.of(widgets, false) });
    const onDefault = aRunner({ running: RunningImage.of(widgets, true) });

    expect(runner.offer.supports(widgets)).toBe(true);
    expect(runner.offer.supports(gadgets)).toBe(false);
    expect(runner.offer.supports(null)).toBe(false);
    expect(onDefault.offer.supports(null)).toBe(true);
  });

  it('serves any image while provisioned without one it names', () => {
    expect(
      aRunner({ host: null }).offer.supports(
        RunnerImage.of('ghcr.io/acme/widgets:1'),
      ),
    ).toBe(true);
  });

  it('is alive only until it must claim, unless it has claimed its work', () => {
    const waiting = aRunner({ claimWithinMs: 1_000 });

    expect(waiting.isAlive(later(999))).toBe(true);
    expect(waiting.isAlive(later(1_000))).toBe(false);
    expect(waiting.claim(RUN, later(10)).isAlive(later(60_000))).toBe(true);
  });

  it('is no longer alive once it has sent no heartbeat for longer than the work it leases allows', () => {
    const running = aRunner().claim(RUN, later(0));
    const checking = aRunner().claim(RunnerWork.check('stack_1'), later(0));

    expect(running.isAlive(later(179_000))).toBe(true);
    expect(running.isAlive(later(180_000))).toBe(false);
    expect(running.heartbeat(later(120_000)).isAlive(later(240_000))).toBe(
      true,
    );
    expect(checking.isAlive(later(11 * 60_000))).toBe(true);
    expect(checking.isAlive(later(12 * 60_000))).toBe(false);
  });

  it('is an open claim only on a host, in no sandbox, with no work, while alive', () => {
    expect(aRunner().isOpenClaimAt(later(0))).toBe(true);
    expect(aRunner().isOpenClaimAt(later(60_000))).toBe(false);
    expect(aRunner({ host: null }).isOpenClaimAt(later(0))).toBe(false);
    expect(aRunner({ enters: 'sandbox_1' }).isOpenClaimAt(later(0))).toBe(
      false,
    );
    expect(aRunner().claim(RUN, later(0)).isOpenClaimAt(later(0))).toBe(false);
  });

  it('waits in a sandbox only while it enters one of them and has no work', () => {
    const idle = [SandboxId.of('sandbox_1'), SandboxId.of('sandbox_2')];

    expect(aRunner({ enters: 'sandbox_2' }).waitsInOneOf(idle)).toBe(true);
    expect(aRunner({ enters: 'sandbox_3' }).waitsInOneOf(idle)).toBe(false);
    expect(aRunner().waitsInOneOf(idle)).toBe(false);
    expect(
      aRunner({ enters: 'sandbox_1' }).claim(RUN, later(0)).waitsInOneOf(idle),
    ).toBe(false);
  });

  it('claims only what was reserved for it, then nothing more', () => {
    const waiting = aRunner();

    expect(waiting.claimsAt(later(1))).toBe('reserved');
    expect(waiting.claim(RUN, later(1)).claimsAt(later(2))).toBe('nothing');
  });

  it('claims one piece of work, ever', () => {
    const working = aRunner().claim(RUN, later(1));

    expect(() => working.claim(RunnerWork.check('stack_1'), later(2))).toThrow(
      RunnerAlreadyClaimedError,
    );
    expect(() => aRunner({ claimWithinMs: 1 }).claim(RUN, later(5))).toThrow(
      RunnerEndedError,
    );
  });

  it('ends with its work, and then is no longer alive', () => {
    const ended = aRunner().claim(RUN, later(1)).ended(later(2));

    expect(ended.hasEnded).toBe(true);
    expect(ended.isAlive(later(3))).toBe(false);
    expect(ended.ended(later(4))).toBe(ended);
    expect(() => ended.heartbeat(later(5))).toThrow(RunnerEndedError);
  });

  it('is discarded when released before it claimed anything, and ended after', () => {
    expect(aRunner().release(later(1)).isDiscarded).toBe(true);

    const working = aRunner().claim(RUN, later(1)).release(later(2));

    expect(working.isDiscarded).toBe(false);
    expect(working.hasEnded).toBe(true);
  });

  it('records its end once, with its pool, its work and the time it claimed the work', () => {
    const ended = aRunner()
      .claim(RUN, later(1))
      .ended(later(2))
      .ended(later(3));

    expect(ended.pullEvents()).toEqual([
      new RunnerEnded(
        ended.id,
        ended.workspaceId,
        CredentialSource.ofId(POOL_ID),
        false,
        RUN,
        STARTED_AT,
        later(1),
        later(2),
        'finished',
      ),
    ]);
  });

  it('ends at its last heartbeat once it stopped sending them, however much later its work ends', () => {
    const silent = aRunner().claim(RUN, later(1_000)).heartbeat(later(60_000));
    const ended = silent.ended(later(60 * 60_000));

    expect(ended.endedAt).toEqual(later(60_000));
    expect(ended.pullEvents()[0]).toMatchObject({
      endedAt: later(60_000),
      ending: 'lost',
    });
  });

  it('is lost when it is released with work after it stopped sending heartbeats', () => {
    const released = aRunner()
      .claim(RUN, later(1_000))
      .release(later(60 * 60_000));

    expect(released.pullEvents()[0]).toMatchObject({ ending: 'lost' });
  });

  it('ends when its work ends while it still sends heartbeats', () => {
    const ended = aRunner()
      .claim(RUN, later(1_000))
      .heartbeat(later(60_000))
      .ended(later(90_000));

    expect(ended.endedAt).toEqual(later(90_000));
  });

  it('records the end of a runner that never claimed in time as when Spotlight last heard from it', () => {
    const released = aRunner({ claimWithinMs: 60_000 }).release(
      later(10 * 60_000),
    );

    expect(released.pullEvents()[0]).toMatchObject({
      endedAt: STARTED_AT,
      ending: 'released',
    });
  });

  it('records its end with no work when it is released before it claimed anything', () => {
    const released = aRunner().release(later(1));

    expect(released.pullEvents()).toEqual([
      new RunnerEnded(
        released.id,
        released.workspaceId,
        CredentialSource.ofId(POOL_ID),
        false,
        null,
        STARTED_AT,
        null,
        later(1),
        'released',
      ),
    ]);
  });

  it('records no second end when an ended runner is released', () => {
    const ended = aRunner().claim(RUN, later(1)).ended(later(2));

    ended.pullEvents();

    expect(ended.release(later(3)).pullEvents()).toEqual([]);
  });

  it('knows that it came in through the platform pool', () => {
    const platform = aRunner({ through: aPlatformPool(), host: null });

    expect(platform.isPlatform).toBe(true);
    expect(aRunner().isPlatform).toBe(false);
    expect(aRunner({ through: aTrust() }).isPlatform).toBe(false);
    expect(
      (platform.release(later(1)).pullEvents()[0] as RunnerEnded).platform,
    ).toBe(true);
  });

  it('is discarded when a reservation it never claimed is dropped, but keeps the work it claimed instead', () => {
    expect(aRunner().reservationDropped(later(1)).isDiscarded).toBe(true);

    const working = aRunner().claim(RUN, later(1));

    expect(working.reservationDropped(later(2))).toBe(working);
  });

  it('lets its egress act only for the work it leases, while it is alive', () => {
    const waiting = aRunner();
    const working = waiting.claim(RUN, later(1));

    expect(waiting.authenticateEgressToken(later(2))).toBeNull();
    expect(working.authenticateEgressToken(later(2))?.equals(RUN)).toBe(true);
    expect(working.authenticateEgressToken(later(180_001))).toBeNull();
    expect(
      working.ended(later(3)).authenticateEgressToken(later(4)),
    ).toBeNull();
  });

  it('lets an egress record for its work while it is alive, and for two minutes after it ends', () => {
    const waiting = aRunner();
    const working = waiting.claim(RUN, later(1));
    const ended = working.ended(later(3));

    expect(waiting.workForConnectionRecords(later(2))).toBeNull();
    expect(working.workForConnectionRecords(later(2))?.equals(RUN)).toBe(true);
    expect(
      ended.workForConnectionRecords(later(3 + 120_000))?.equals(RUN),
    ).toBe(true);
    expect(ended.workForConnectionRecords(later(3 + 120_001))).toBeNull();
    expect(working.workForConnectionRecords(later(180_001))).toBeNull();
  });

  it('has no egress when a pool provisioned it, since no host runs an egress sidecar for it', () => {
    const provisioned = aRunner({ host: null }).claim(RUN, later(1));

    expect(provisioned.egressTokenHash).toBeNull();
    expect(provisioned.authenticateEgressToken(later(2))).toBeNull();
  });

  it('knows the work it leases', () => {
    const working = aRunner().claim(RUN, later(1));

    expect(working.work?.equals(RunnerWork.run('run_1'))).toBe(true);
    expect(working.work?.equals(RunnerWork.check('run_1'))).toBe(false);
  });

  it('takes the credential source of the pool or trust it started under, on the host that requested it', () => {
    const pooled = aRunner({ host: 'HOST0000000000000042' });
    const trusted = aRunner({ through: aTrust() });

    expect(pooled.source.equals(CredentialSource.ofId(POOL_ID))).toBe(true);
    expect(pooled.hostId?.equals(HostId.of('HOST0000000000000042'))).toBe(true);
    expect(trusted.source.equals(CredentialSource.ofId(TRUST_ID))).toBe(true);
    expect(trusted.workspaceId.value).toBe('ws_1');
  });

  it('answers to its trust’s labels when it started through a trust', () => {
    expect(aRunner({ through: aTrust() }).offer.values).toEqual([
      'vpc-internal',
    ]);
  });

  it('is started with no host when a pool provisioned it', () => {
    expect(aRunner({ host: null }).hostId).toBeNull();
  });

  it('records the sandbox it enters, which only a runner on a host can enter', () => {
    expect(aRunner({ enters: 'sandbox_1' }).enters).toEqual(
      SandboxId.of('sandbox_1'),
    );
    expect(aRunner().enters).toBeNull();
    expect(() => aRunner({ host: null, enters: 'sandbox_1' })).toThrow(
      InconsistentStateError,
    );
  });

  it('is not started for a pool that is deleted, a trust that is deleted, nor with no time to claim', () => {
    expect(() =>
      aRunner({ through: aPullPool().delete(changeActorIn()) }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      aRunner({ through: aTrust().delete(changeActorIn()) }),
    ).toThrow(InconsistentStateError);
    expect(() => aRunner({ claimWithinMs: 0 })).toThrow(InconsistentStateError);
  });

  it('is retained for a day after it ended', () => {
    const DAY = 24 * 60 * 60_000;

    expect(Runner.endedRetentionSince(later(DAY))).toEqual(STARTED_AT);
  });
});
