import { describe, expect, it } from 'vitest';
import {
  approvableTogether,
  askedByAgent,
  decidedBy,
  filterOf,
  givenMemories,
  memoryPath,
  narrowed,
  type ProposedMemory,
  paramsOf,
  placeOf,
  proposalStateOf,
  type RunProposal,
  reachOf,
  rememberedCounts,
  stepLabel,
  type TeamMemory,
  usedBy,
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

describe('what a run remembered', () => {
  const proposal = (over: Partial<RunProposal>): RunProposal => ({
    ...memory(),
    handle: null,
    standing: null,
    ...over,
  });

  it('counts the runs that used a memory', () => {
    expect(usedBy(0)).toBe('No run has used it yet');
    expect(usedBy(1)).toBe('Used by 1 run');
    expect(usedBy(4)).toBe('Used by 4 runs');
  });

  it('gives what was briefed, then what was recalled on top of it, once each', () => {
    const briefed = { id: 'memory_b' } as TeamMemory;
    const both = { id: 'memory_both' } as TeamMemory;
    const recalled = { id: 'memory_r' } as TeamMemory;

    expect(
      givenMemories({
        briefed: [briefed, both],
        cut: [{ id: 'memory_c' } as TeamMemory],
        recalled: [both, recalled],
        proposed: [],
        reviewItemId: null,
      }),
    ).toEqual([briefed, both, recalled]);
  });

  it('counts only what there was', () => {
    expect(
      rememberedCounts({
        briefed: [],
        cut: [],
        recalled: [],
        proposed: [proposal({})],
        reviewItemId: null,
      }),
    ).toEqual([{ what: 'Proposed', count: 1 }]);
  });

  it('says where a proposal stands', () => {
    expect(proposalStateOf(proposal({}))).toBe('Waiting for you');
    expect(proposalStateOf(proposal({ state: 'rejected' }))).toBe('Rejected');
    expect(
      proposalStateOf(proposal({ state: 'approved', standing: 'stands' })),
    ).toBe('Kept');
    expect(
      proposalStateOf(proposal({ state: 'approved', standing: 'retired' })),
    ).toBe('Kept, since retired');
  });

  it('links to one memory on the team’s memory page', () => {
    expect(memoryPath('acme', 'team_1', 'memory 1')).toBe(
      '/w/acme/team/team_1/memory?memory=memory%201',
    );
  });
});
