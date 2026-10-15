import {
  loopStopFor,
  MOST_DEPTH,
} from '@integrations/domain/services/loop-guard';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { describe, expect, it } from 'vitest';

const moved = (from: string, to: string) => ({
  kind: 'event' as const,
  key: `task.moved:task_1:${from} → ${to}`,
  saying: `task.moved (${from} → ${to})`,
});

const notify = (from: string, to: string) => ({
  kind: 'hook' as const,
  key: `hook:notify:${moved(from, to).key}`,
  saying: 'the hook notify',
});

const slack = {
  kind: 'delivery' as const,
  key: 'delivery:slack',
  saying: 'a delivery from slack',
};

describe('loopStopFor', () => {
  it('lets a hook fire once for a change', () => {
    expect(
      loopStopFor({
        chain: CausalChain.none().followedBy(moved('build', 'review')),
        firing: notify('build', 'review'),
        recentRepeats: 0,
      }),
    ).toBeNull();
  });

  it('stops a hook firing again for a change its own firing caused, naming the chain', () => {
    const chain = CausalChain.none()
      .followedBy(moved('build', 'review'))
      .followedBy(notify('build', 'review'))
      .followedBy(slack)
      .followedBy(moved('review', 'build'))
      .followedBy(notify('review', 'build'))
      .followedBy(slack)
      .followedBy(moved('build', 'review'));

    expect(
      loopStopFor({
        chain,
        firing: notify('build', 'review'),
        recentRepeats: 0,
      }),
    ).toEqual({
      kind: 'repeated',
      saying:
        'It would fire again for the change that caused it. Cause chain: task.moved (build → review) → the hook notify → a delivery from slack → task.moved (review → build) → the hook notify → a delivery from slack → task.moved (build → review) → the hook notify',
    });
  });

  it('lets a hook fire for a different change in the same chain', () => {
    const chain = CausalChain.none()
      .followedBy(moved('build', 'review'))
      .followedBy(notify('build', 'review'))
      .followedBy(slack)
      .followedBy(moved('review', 'build'));

    expect(
      loopStopFor({
        chain,
        firing: notify('review', 'build'),
        recentRepeats: 0,
      }),
    ).toBeNull();
  });

  it(`stops a chain already ${MOST_DEPTH} causes deep`, () => {
    let chain = CausalChain.none();
    for (let each = 0; each < MOST_DEPTH; each += 1) {
      chain = chain.followedBy({ ...slack, key: `delivery:${each}` });
    }

    expect(
      loopStopFor({ chain, firing: notify('a', 'b'), recentRepeats: 0 })?.kind,
    ).toBe('too-deep');
  });

  it('stops a hook that keeps firing for the same change though no chain came back', () => {
    const stop = loopStopFor({
      chain: CausalChain.none().followedBy(moved('build', 'review')),
      firing: notify('build', 'review'),
      recentRepeats: 3,
    });

    expect(stop?.kind).toBe('recurring');
    expect(stop?.saying).toContain('fired 3 times');
  });
});
