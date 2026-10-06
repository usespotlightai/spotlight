import { describe, expect, it } from 'vitest';
import {
  appliesTo,
  filterOf,
  givenMemories,
  memoryFilesOf,
  memoryPath,
  narrowed,
  type ProposedMemory,
  paramsOf,
  placeOf,
  proposalStateOf,
  proposalTitleOf,
  proposedSummary,
  type RunProposal,
  rememberedCounts,
  speakerOf,
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
  harness: null,
  steps: [],
  notes: [],
  ...over,
});

describe('appliesTo and memoryFilesOf', () => {
  it('says where a memory applies, and the files it bears on', () => {
    expect(appliesTo(memory())).toBe('The whole team');
    expect(memoryFilesOf(memory())).toBeNull();

    const scoped = memory({
      reach: 'station',
      repository: 'acme/api',
      paths: ['src/uploads.ts'],
    });
    expect(appliesTo(scoped)).toBe('This station');
    expect(memoryFilesOf(scoped)).toBe('src/uploads.ts in acme/api');
    expect(memoryFilesOf(memory({ repository: 'acme/api' }))).toBe('acme/api');
  });
});

describe('proposedSummary', () => {
  it('counts what the agent proposed, and what still waits', () => {
    expect(
      proposedSummary([memory(), memory({ id: 'memory_2' })], 'Claude Code'),
    ).toBe('Claude Code proposed 2 memories · 2 to review');
    expect(proposedSummary([memory({ state: 'approved' })])).toBe(
      'The agent proposed 1 memory · all decided',
    );
  });
});

describe('proposalTitleOf', () => {
  it('says it waits, then who decided it and how', () => {
    expect(proposalTitleOf(memory())).toBe('Waiting for your approval');
    expect(
      proposalTitleOf(
        memory({
          state: 'rejected',
          decision: { by: 'user_1', name: 'Maya Chen', at: '2026-09-27' },
        }),
      ),
    ).toBe('Memory rejected by Maya Chen');
    expect(
      proposalTitleOf(
        memory({
          state: 'approved',
          decision: { by: 'user_1', name: null, at: '2026-09-27' },
        }),
      ),
    ).toBe('Memory approved');
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
    ).toBe('Line deleted');
  });
});

describe('speakerOf', () => {
  it('names the teammate who said it, and says words came from another tool', () => {
    expect(
      speakerOf({
        position: 1,
        by: 'person',
        author: { id: 'user_1', name: 'Maya Chen', image: null },
        text: 'A.',
      }),
    ).toBe('Maya Chen');
    expect(
      speakerOf({ position: 1, by: 'person', author: null, text: 'A.' }),
    ).toBe('A teammate');
    expect(
      speakerOf({ position: 2, by: 'world', author: null, text: 'B.' }),
    ).toBe('From another tool');
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
    expect(usedBy(0)).toBe('Not used by any run yet');
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
    ).toBe('Kept, now retired');
  });

  it('links to one memory on the team’s memory page', () => {
    expect(memoryPath('acme', 'team_1', 'memory 1')).toBe(
      '/w/acme/team/team_1/memory?memory=memory%201',
    );
  });
});
