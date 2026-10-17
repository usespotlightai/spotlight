import { describe, expect, it } from 'vitest';
import {
  appliesTo,
  authorOf,
  filterOf,
  givenMemories,
  memoryFilesOf,
  memoryPath,
  narrowed,
  type ProposedMemory,
  paramsOf,
  placeTreeOf,
  proposalStateOf,
  proposalTitleOf,
  proposedSummary,
  type RunProposal,
  rememberedCounts,
  type TeamMemory,
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
      new URLSearchParams('status=retired&kind=failure&path=src'),
    );

    expect(filter).toEqual({
      status: 'retired',
      kind: 'failure',
      lineId: null,
      stationId: null,
      repository: null,
      path: 'src',
    });
    expect(narrowed(filter)).toBe(true);
    expect(paramsOf(filter)).toEqual({
      status: 'retired',
      kind: 'failure',
      path: 'src',
    });
    expect(paramsOf(filterOf(new URLSearchParams()))).toEqual({});
  });
});

describe('placeTreeOf', () => {
  const lines = [
    {
      id: 'line_delivery',
      name: 'Delivery',
      stations: [{ id: 'station_build', name: 'Implementation' }],
    },
  ] as unknown as Parameters<typeof placeTreeOf>[1];

  it('nests the station, repository and each path under the line', () => {
    expect(
      placeTreeOf(
        {
          lineId: 'line_delivery',
          stationId: 'station_build',
          repository: 'acme/worker',
          paths: ['src/retries/deliver.ts', 'src/queue/'],
        },
        lines,
      ),
    ).toEqual({
      kind: 'line',
      label: 'Delivery',
      joinedBy: null,
      children: [
        {
          kind: 'station',
          label: 'Implementation',
          joinedBy: ' › ',
          children: [
            {
              kind: 'repository',
              label: 'acme/worker',
              joinedBy: ' › ',
              children: [
                {
                  kind: 'path',
                  label: 'src/retries/deliver.ts',
                  joinedBy: ' › ',
                  children: [],
                },
                {
                  kind: 'path',
                  label: 'src/queue/',
                  joinedBy: ' › ',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('says how each part joins the one before it on a single line', () => {
    const joined = (node: ReturnType<typeof placeTreeOf>): string =>
      `${node.joinedBy ?? ''}${node.label}${node.children.map(joined).join('')}`;

    expect(
      joined(
        placeTreeOf(
          {
            lineId: 'line_delivery',
            stationId: 'station_build',
            repository: 'acme/worker',
            paths: ['src/a.ts', 'src/b.ts'],
          },
          lines,
        ),
      ),
    ).toBe('Delivery › Implementation › acme/worker › src/a.ts › src/b.ts');
  });

  it('names a line that is gone rather than calling it the whole team', () => {
    expect(
      placeTreeOf(
        { lineId: 'line_gone', stationId: null, repository: null, paths: [] },
        [],
      ).label,
    ).toBe('Line deleted');
  });

  it('roots a team-wide memory at the team', () => {
    expect(
      placeTreeOf(
        { lineId: null, stationId: null, repository: 'acme/api', paths: [] },
        lines,
      ),
    ).toEqual({
      kind: 'team',
      label: 'The whole team',
      joinedBy: null,
      children: [
        {
          kind: 'repository',
          label: 'acme/api',
          joinedBy: ' › ',
          children: [],
        },
      ],
    });
  });
});

describe('authorOf', () => {
  it('names the teammate who wrote the note, and names another tool as the author of a note from it', () => {
    expect(
      authorOf({
        position: 1,
        by: 'person',
        author: { id: 'user_1', name: 'Maya Chen', image: null },
        text: 'A.',
      }),
    ).toBe('Maya Chen');
    expect(
      authorOf({ position: 1, by: 'person', author: null, text: 'A.' }),
    ).toBe('A teammate');
    expect(
      authorOf({ position: 2, by: 'world', author: null, text: 'B.' }),
    ).toBe('Another tool');
  });
});

describe('what a run remembered', () => {
  const proposal = (over: Partial<RunProposal>): RunProposal => ({
    ...memory(),
    handle: null,
    status: null,
    ...over,
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

  it('says the state of a proposal', () => {
    expect(proposalStateOf(proposal({}))).toBe('Waiting for you');
    expect(proposalStateOf(proposal({ state: 'rejected' }))).toBe('Rejected');
    expect(
      proposalStateOf(proposal({ state: 'approved', status: 'active' })),
    ).toBe('Kept');
    expect(
      proposalStateOf(proposal({ state: 'approved', status: 'retired' })),
    ).toBe('Kept, now retired');
  });

  it('links to one memory on the team’s memory page', () => {
    expect(memoryPath('acme', 'team_1', 'memory 1')).toBe(
      '/w/acme/team/team_1/memory?memory=memory%201',
    );
  });
});
