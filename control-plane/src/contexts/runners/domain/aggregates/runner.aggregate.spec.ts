import {
  aPullPool,
  aRunner,
  aTrust,
  POOL_ID,
  STARTED_AT,
  TRUST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerSpentError } from '@runners/domain/exceptions/runner-spent.error';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it } from 'vitest';

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const RUN = RunnerWork.run('run_1');

describe('Runner', () => {
  it('answers to its pool’s labels and the releases it reports', () => {
    const runner = aRunner({
      installed: [InstalledHarness.reported('claude-code', [], '2.1.0')],
    });

    expect(runner.terms.values).toEqual(['linux', 'claude-code@2.1.0']);
  });

  it('stands only until it must claim, unless it has taken its work', () => {
    const waiting = aRunner({ claimWithinMs: 1_000 });

    expect(waiting.standsAt(later(999))).toBe(true);
    expect(waiting.standsAt(later(1_000))).toBe(false);
    expect(waiting.took(RUN, later(10)).standsAt(later(60_000))).toBe(true);
  });

  it('no longer stands once it has gone unseen longer than the work it holds allows', () => {
    const running = aRunner().took(RUN, later(0));
    const checking = aRunner().took(RunnerWork.check('stack_1'), later(0));

    expect(running.standsAt(later(179_000))).toBe(true);
    expect(running.standsAt(later(180_000))).toBe(false);
    expect(running.seen(later(120_000)).standsAt(later(240_000))).toBe(true);
    expect(checking.standsAt(later(11 * 60_000))).toBe(true);
    expect(checking.standsAt(later(12 * 60_000))).toBe(false);
  });

  it('claims only what was reserved for it, then nothing more', () => {
    const waiting = aRunner();

    expect(waiting.claimsAt(later(1))).toBe('reserved');
    expect(waiting.took(RUN, later(1)).claimsAt(later(2))).toBe('nothing');
  });

  it('takes one piece of work, ever', () => {
    const working = aRunner().took(RUN, later(1));

    expect(() => working.took(RunnerWork.check('stack_1'), later(2))).toThrow(
      RunnerSpentError,
    );
    expect(() => aRunner({ claimWithinMs: 1 }).took(RUN, later(5))).toThrow(
      RunnerSpentError,
    );
  });

  it('ends with its work, and then no longer stands', () => {
    const ended = aRunner().took(RUN, later(1)).ended(later(2));

    expect(ended.hasEnded).toBe(true);
    expect(ended.standsAt(later(3))).toBe(false);
    expect(ended.ended(later(4))).toBe(ended);
    expect(() => ended.seen(later(5))).toThrow(RunnerSpentError);
  });

  it('is discarded when let go before it took anything, and ended after', () => {
    expect(aRunner().letGo(later(1)).isDiscarded).toBe(true);

    const working = aRunner().took(RUN, later(1)).letGo(later(2));

    expect(working.isDiscarded).toBe(false);
    expect(working.hasEnded).toBe(true);
  });

  it('knows the work it holds', () => {
    const working = aRunner().took(RUN, later(1));

    expect(working.holds(RunnerWork.run('run_1'))).toBe(true);
    expect(working.holds(RunnerWork.check('run_1'))).toBe(false);
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

  it('is not started for a pool that is retired, a trust that is withdrawn, nor with no time to claim', () => {
    expect(() =>
      aRunner({ through: aPullPool().retired(attributedIn()) }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      aRunner({ through: aTrust().withdrawn(attributedIn()) }),
    ).toThrow(InconsistentStateError);
    expect(() => aRunner({ claimWithinMs: 0 })).toThrow(InconsistentStateError);
  });
});
