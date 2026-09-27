import { describe, expect, it } from 'vitest';
import {
  approvableTogether,
  askedByAgent,
  decidedBy,
  filterOf,
  narrowed,
  type ProposedMemory,
  paramsOf,
  placeOf,
  reachOf,
  stepLabel,
} from '@/lib/memory';

const memory = (over: Partial<ProposedMemory> = {}): ProposedMemory => ({
  id: 'memory_1',
  kind: 'preference',
  body: 'Name branches after the ticket.',
  source: 'person',
  origin: 'drafted',
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

describe('filterOf and paramsOf', () => {
  it('reads a filter from the address and writes back only what narrows it', () => {
    const filter = filterOf(
      new URLSearchParams('standing=retired&kind=failure&path=src'),
    );

    expect(filter).toEqual({
      standing: 'retired',
      kind: 'failure',
      lineId: null,
      stationId: null,
      repository: null,
      path: 'src',
    });
    expect(narrowed(filter)).toBe(true);
    expect(paramsOf(filter)).toEqual({
      standing: 'retired',
      kind: 'failure',
      path: 'src',
    });
    expect(paramsOf(filterOf(new URLSearchParams()))).toEqual({});
  });
});

describe('placeOf', () => {
  it('names a line that is gone rather than calling it the whole team', () => {
    expect(
      placeOf(
        { lineId: 'line_gone', stationId: null, repository: null, paths: [] },
        [],
      ),
    ).toBe('A line that is gone');
  });
});

describe('stepLabel and askedByAgent', () => {
  it('names what the agent did in the step a memory rests on', () => {
    expect(stepLabel('thought')).toBe('The agent thought');
    expect(stepLabel('handover')).toBe('The agent handed over');
    expect(stepLabel('remember')).toBe('The agent asked the team to remember');
  });

  it('tells a memory the agent asked for from one drafted after the run', () => {
    expect(askedByAgent(memory({ origin: 'remembered' }))).toBe(true);
    expect(askedByAgent(memory())).toBe(false);
  });
});
