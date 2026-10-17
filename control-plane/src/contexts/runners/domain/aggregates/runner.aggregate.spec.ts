import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import {
  aPullPool,
  aRunner,
  aTrust,
  POOL_ID,
  STARTED_AT,
  TRUST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerAlreadyClaimedError } from '@runners/domain/exceptions/runner-already-claimed.error';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { describe, expect, it } from 'vitest';

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const RUN = RunnerWork.run('run_1');

describe('Runner', () => {
  it('answers to its pool’s labels, not to the releases it reports', () => {
    const runner = aRunner({
      installed: [InstalledHarness.reported('claude-code', [], '2.1.0')],
    });

    expect(runner.terms.values).toEqual(['linux']);
  });

  it('serves only work asking for the image it runs, or for none when that image is the default one', () => {
    const widgets = RunnerImage.of('ghcr.io/acme/widgets:1');
    const gadgets = RunnerImage.of('ghcr.io/acme/gadgets:1');
    const runner = aRunner({ running: RunningImage.of(widgets, false) });
    const onDefault = aRunner({ running: RunningImage.of(widgets, true) });

    expect(runner.terms.serves(widgets)).toBe(true);
    expect(runner.terms.serves(gadgets)).toBe(false);
    expect(runner.terms.serves(null)).toBe(false);
    expect(onDefault.terms.serves(null)).toBe(true);
  });

  it('serves any image while provisioned without one it names', () => {
    expect(
      aRunner({ host: null }).terms.serves(
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
      RunnerAlreadyClaimedError,
    );
  });

  it('ends with its work, and then is no longer alive', () => {
    const ended = aRunner().claim(RUN, later(1)).ended(later(2));

    expect(ended.hasEnded).toBe(true);
    expect(ended.isAlive(later(3))).toBe(false);
    expect(ended.ended(later(4))).toBe(ended);
    expect(() => ended.heartbeat(later(5))).toThrow(RunnerAlreadyClaimedError);
  });

  it('is discarded when released before it claimed anything, and ended after', () => {
    expect(aRunner().release(later(1)).isDiscarded).toBe(true);

    const working = aRunner().claim(RUN, later(1)).release(later(2));

    expect(working.isDiscarded).toBe(false);
    expect(working.hasEnded).toBe(true);
  });

  it('is discarded when a reservation it never claimed is dropped, but keeps the work it claimed instead', () => {
    expect(aRunner().reservationDropped(later(1)).isDiscarded).toBe(true);

    const working = aRunner().claim(RUN, later(1));

    expect(working.reservationDropped(later(2))).toBe(working);
  });

  it('lets its egress act only for the work it leases, while it is alive', () => {
    const waiting = aRunner();
    const working = waiting.claim(RUN, later(1));

    expect(waiting.workEgressActsFor(later(2))).toBeNull();
    expect(working.workEgressActsFor(later(2))?.equals(RUN)).toBe(true);
    expect(working.workEgressActsFor(later(180_001))).toBeNull();
    expect(working.ended(later(3)).workEgressActsFor(later(4))).toBeNull();
  });

  it('lets an egress record for its work while it is alive, and for two minutes after it ends', () => {
    const waiting = aRunner();
    const working = waiting.claim(RUN, later(1));
    const ended = working.ended(later(3));

    expect(waiting.workEgressRecordsFor(later(2))).toBeNull();
    expect(working.workEgressRecordsFor(later(2))?.equals(RUN)).toBe(true);
    expect(ended.workEgressRecordsFor(later(3 + 120_000))?.equals(RUN)).toBe(
      true,
    );
    expect(ended.workEgressRecordsFor(later(3 + 120_001))).toBeNull();
    expect(working.workEgressRecordsFor(later(180_001))).toBeNull();
  });

  it('has no egress when a pool provisioned it, since no host runs beside it', () => {
    const provisioned = aRunner({ host: null }).claim(RUN, later(1));

    expect(provisioned.egressTokenHash).toBeNull();
    expect(provisioned.workEgressActsFor(later(2))).toBeNull();
  });

  it('knows the work it leases', () => {
    const working = aRunner().claim(RUN, later(1));

    expect(working.hasLeaseOn(RunnerWork.run('run_1'))).toBe(true);
    expect(working.hasLeaseOn(RunnerWork.check('run_1'))).toBe(false);
  });

  it('is admitted through the pool or trust it started under, on the host that asked', () => {
    const pooled = aRunner({ host: 'HOST0000000000000042' });
    const trusted = aRunner({ through: aTrust() });

    expect(pooled.admission.equals(Admission.through(POOL_ID))).toBe(true);
    expect(pooled.hostId?.equals(HostId.of('HOST0000000000000042'))).toBe(true);
    expect(trusted.admission.equals(Admission.through(TRUST_ID))).toBe(true);
    expect(trusted.workspaceId.value).toBe('ws_1');
  });

  it('answers to its trust’s labels when a trust admitted it', () => {
    expect(aRunner({ through: aTrust() }).terms.values).toEqual([
      'vpc-internal',
    ]);
  });

  it('is started with no host when a pool provisioned it', () => {
    expect(aRunner({ host: null }).hostId).toBeNull();
  });

  it('is not started for a pool that is deleted, a trust that is deleted, nor with no time to claim', () => {
    expect(() =>
      aRunner({ through: aPullPool().delete(attributedIn()) }),
    ).toThrow(InconsistentStateError);
    expect(() => aRunner({ through: aTrust().delete(attributedIn()) })).toThrow(
      InconsistentStateError,
    );
    expect(() => aRunner({ claimWithinMs: 0 })).toThrow(InconsistentStateError);
  });

  it('is retained for a day after it ended', () => {
    const DAY = 24 * 60 * 60_000;

    expect(Runner.endedRetentionSince(later(DAY))).toEqual(STARTED_AT);
  });
});
