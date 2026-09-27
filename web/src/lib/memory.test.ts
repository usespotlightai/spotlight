import { describe, expect, it } from 'vitest';
import {
  approvableTogether,
  decidedBy,
  type ProposedMemory,
  reachOf,
} from '@/lib/memory';

const memory = (over: Partial<ProposedMemory> = {}): ProposedMemory => ({
  id: 'memory_1',
  kind: 'preference',
  body: 'Name branches after the ticket.',
  source: 'person',
  state: 'proposed',
  reach: 'team',
  repository: null,
  paths: [],
  supersedes: null,
  decision: null,
  steps: [],
  notes: [],
  ...over,
});

describe('approvableTogether', () => {
  it('holds the undecided memories from inside the team, and never one from outside', () => {
    const inside = memory({ id: 'inside' });
    const outside = memory({ id: 'outside', source: 'outside' });
    const decided = memory({ id: 'decided', state: 'approved' });

    expect(approvableTogether([inside, outside, decided])).toEqual([inside]);
  });
});

describe('reachOf', () => {
  it('says where a memory applies, down to its files', () => {
    expect(reachOf(memory())).toBe('Applies to the whole team');
    expect(
      reachOf(
        memory({
          reach: 'station',
          repository: 'acme/api',
          paths: ['src/uploads.ts'],
        }),
      ),
    ).toBe('Applies to this station, in src/uploads.ts of acme/api');
  });
});

describe('decidedBy', () => {
  it('says who decided a memory, and nothing while it waits', () => {
    expect(decidedBy(memory())).toBeNull();
    expect(
      decidedBy(
        memory({
          state: 'rejected',
          decision: { by: 'user_1', name: 'Maya Chen', at: '2026-09-27' },
        }),
      ),
    ).toBe('Maya Chen rejected this.');
  });
});
