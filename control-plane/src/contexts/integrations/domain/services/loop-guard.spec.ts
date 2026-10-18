import {
  loopStopFor,
  MAX_DEPTH,
} from '@integrations/domain/services/loop-guard';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { describe, expect, it } from 'vitest';

const moved = (from: string, to: string) => ({
  kind: 'event' as const,
  key: `task.moved:task_1:${from} → ${to}`,
  description: `task.moved (${from} → ${to})`,
});

const notify = (from: string, to: string) => ({
  kind: 'hook' as const,
  key: `hook:notify:${moved(from, to).key}`,
  description: 'the hook notify',
});

const slack = {
  kind: 'delivery' as const,
  key: 'delivery:slack',
  description: 'a delivery from slack',
};

describe('loopStopFor', () => {
  it('lets a hook fire once for a change', () => {
    expect(
      loopStopFor({
        chain: CausalChain.none().append(moved('build', 'review')),
        firing: notify('build', 'review'),
        recentRepeats: 0,
      }),
    ).toBeNull();
  });

  it('stops a hook firing again for a change its own firing caused, naming the chain', () => {
    const chain = CausalChain.none()
      .append(moved('build', 'review'))
      .append(notify('build', 'review'))
      .append(slack)
      .append(moved('review', 'build'))
      .append(notify('review', 'build'))
      .append(slack)
      .append(moved('build', 'review'));

    expect(
      loopStopFor({
        chain,
        firing: notify('build', 'review'),
        recentRepeats: 0,
      }),
    ).toEqual({
      kind: 'repeated',
      description:
        'It would fire again for the change that caused it. Cause chain: task.moved (build → review) → the hook notify → a delivery from slack → task.moved (review → build) → the hook notify → a delivery from slack → task.moved (build → review) → the hook notify',
    });
  });

  it('lets a hook fire for a different change in the same chain', () => {
    const chain = CausalChain.none()
      .append(moved('build', 'review'))
      .append(notify('build', 'review'))
      .append(slack)
      .append(moved('review', 'build'));

    expect(
      loopStopFor({
        chain,
        firing: notify('review', 'build'),
        recentRepeats: 0,
      }),
    ).toBeNull();
  });

  it(`stops a chain already ${MAX_DEPTH} causes deep`, () => {
    let chain = CausalChain.none();
    for (let each = 0; each < MAX_DEPTH; each += 1) {
      chain = chain.append({ ...slack, key: `delivery:${each}` });
    }

    expect(
      loopStopFor({ chain, firing: notify('a', 'b'), recentRepeats: 0 })?.kind,
    ).toBe('too-deep');
  });

  it('stops a hook that keeps firing for the same change though no chain came back', () => {
    const stop = loopStopFor({
      chain: CausalChain.none().append(moved('build', 'review')),
      firing: notify('build', 'review'),
      recentRepeats: 3,
    });

    expect(stop?.kind).toBe('recurring');
    expect(stop?.description).toContain('fired 3 times');
  });
});
