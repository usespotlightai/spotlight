import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { describe, expect, it } from 'vitest';

const moved = {
  kind: 'event' as const,
  key: 'task.moved:t-1:build>review',
  description: 'task.moved of t-1 from build to review',
};

const hook = {
  kind: 'hook' as const,
  key: 'hook:h-1:task.moved:t-1:build>review',
  description: 'the hook notify',
};

describe('CausalChain', () => {
  it('starts with nothing behind it', () => {
    expect(CausalChain.none().started).toBe(false);
    expect(CausalChain.none().depth).toBe(0);
  });

  it('grows one link deeper with each cause', () => {
    const chain = CausalChain.none().followedBy(moved).followedBy(hook);

    expect(chain.depth).toBe(2);
    expect(chain.contains(hook.key)).toBe(true);
    expect(chain.description).toBe(
      'task.moved of t-1 from build to review → the hook notify',
    );
  });

  it('keeps its most recent links but remembers how deep it went', () => {
    let chain = CausalChain.none();
    for (let each = 0; each < 40; each += 1) {
      chain = chain.followedBy({ ...moved, key: `k-${each}` });
    }

    expect(chain.depth).toBe(40);
    expect(chain.links).toHaveLength(32);
    expect(chain.contains('k-39')).toBe(true);
    expect(chain.contains('k-0')).toBe(false);
    expect(chain.description.startsWith('… → ')).toBe(true);
  });

  it('reads back what it stored, and none from nothing stored', () => {
    const chain = CausalChain.none().followedBy(moved);

    expect(CausalChain.read(chain.stored).equals(chain)).toBe(true);
    expect(CausalChain.read(null).started).toBe(false);
  });

  it('rejects what is not a chain', () => {
    expect(() => CausalChain.read('nonsense')).toThrow(InconsistentStateError);
    expect(() => CausalChain.read({ depth: 1 })).toThrow(
      InconsistentStateError,
    );
  });

  it('rejects a link without a description', () => {
    expect(() =>
      CausalChain.read({ links: [{ kind: 'rumour', key: 'x' }], depth: 1 }),
    ).toThrow(InconsistentStateError);
  });
});
