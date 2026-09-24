import {
  aPoolRunner,
  aPullPool,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { PoolRunnerSpentError } from '@runners/domain/exceptions/pool-runner-spent.error';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { PoolWork } from '@runners/domain/value-objects/pool-work.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it } from 'vitest';

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const RUN = PoolWork.run('run_1');

describe('PoolRunner', () => {
  it('answers to its pool’s labels and the releases it reports', () => {
    const runner = aPoolRunner({
      installed: [InstalledHarness.reported('claude-code', [], '2.1.0')],
    });

    expect(runner.terms.values).toEqual(['linux', 'claude-code@2.1.0']);
  });

  it('stands only until it must claim, unless it has taken its work', () => {
    const waiting = aPoolRunner({ claimWithinMs: 1_000 });

    expect(waiting.standsAt(later(999))).toBe(true);
    expect(waiting.standsAt(later(1_000))).toBe(false);
    expect(waiting.took(RUN, later(10)).standsAt(later(60_000))).toBe(true);
  });

  it('no longer stands once it has gone unseen longer than the work it holds allows', () => {
    const running = aPoolRunner().took(RUN, later(0));
    const checking = aPoolRunner().took(PoolWork.check('stack_1'), later(0));

    expect(running.standsAt(later(179_000))).toBe(true);
    expect(running.standsAt(later(180_000))).toBe(false);
    expect(running.seen(later(120_000)).standsAt(later(240_000))).toBe(true);
    expect(checking.standsAt(later(11 * 60_000))).toBe(true);
    expect(checking.standsAt(later(12 * 60_000))).toBe(false);
  });

  it('claims only what was reserved for it, then nothing more', () => {
    const waiting = aPoolRunner();

    expect(waiting.claimsAt(later(1))).toBe('reserved');
    expect(waiting.took(RUN, later(1)).claimsAt(later(2))).toBe('nothing');
  });

  it('takes one piece of work, ever', () => {
    const working = aPoolRunner().took(RUN, later(1));

    expect(() => working.took(PoolWork.check('stack_1'), later(2))).toThrow(
      PoolRunnerSpentError,
    );
    expect(() => aPoolRunner({ claimWithinMs: 1 }).took(RUN, later(5))).toThrow(
      PoolRunnerSpentError,
    );
  });

  it('ends with its work, and then no longer stands', () => {
    const ended = aPoolRunner().took(RUN, later(1)).ended(later(2));

    expect(ended.hasEnded).toBe(true);
    expect(ended.standsAt(later(3))).toBe(false);
    expect(ended.ended(later(4))).toBe(ended);
    expect(() => ended.seen(later(5))).toThrow(PoolRunnerSpentError);
  });

  it('is discarded when let go before it took anything, and ended after', () => {
    expect(aPoolRunner().letGo(later(1)).isDiscarded).toBe(true);

    const working = aPoolRunner().took(RUN, later(1)).letGo(later(2));

    expect(working.isDiscarded).toBe(false);
    expect(working.hasEnded).toBe(true);
  });

  it('knows the work it holds', () => {
    const working = aPoolRunner().took(RUN, later(1));

    expect(working.holds(PoolWork.run('run_1'))).toBe(true);
    expect(working.holds(PoolWork.check('run_1'))).toBe(false);
  });

  it('is not started for a pool that is retired, nor with no time to claim', () => {
    expect(() =>
      aPoolRunner({ pool: aPullPool().retired(attributedIn()) }),
    ).toThrow(InconsistentStateError);
    expect(() => aPoolRunner({ claimWithinMs: 0 })).toThrow(
      InconsistentStateError,
    );
  });
});
