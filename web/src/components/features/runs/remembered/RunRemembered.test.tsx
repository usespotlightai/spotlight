import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunRemembered } from '@/components/features/runs/remembered/RunRemembered';
import type { RunMemories, RunProposal, TeamMemory } from '@/lib/memory';

const refetch = vi.fn();
const rememberedState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch,
};
const retire = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isError: false,
};

vi.mock('@/hooks/api/useRunMemories', () => ({
  useRunMemories: () => rememberedState,
}));
vi.mock('@/hooks/api/useRetireMemory', () => ({
  useRetireMemory: () => retire,
}));

const memory = (over: Partial<TeamMemory>): TeamMemory => ({
  id: 'memory_1',
  handle: 'M-1',
  kind: 'preference',
  body: 'Name branches after the ticket.',
  source: 'person',
  standing: 'stands',
  reach: 'team',
  lineId: null,
  stationId: null,
  repository: null,
  paths: [],
  approvedBy: { id: 'user_2', name: 'Maya Chen' },
  approvedAt: '2026-09-27T10:00:00.000Z',
  supersedes: null,
  retirement: null,
  grounds: null,
  runs: 1,
  ...over,
});

const proposal = (over: Partial<RunProposal>): RunProposal => ({
  id: 'memory_p',
  kind: 'failure',
  body: 'The worker test hangs without Redis.',
  source: 'run',
  origin: 'remembered',
  state: 'proposed',
  reach: 'line',
  repository: null,
  paths: [],
  supersedes: null,
  decision: null,
  steps: [],
  notes: [],
  handle: null,
  standing: null,
  ...over,
});

const REMEMBERED: RunMemories = {
  briefed: [memory({ id: 'memory_b', handle: 'M-2', body: 'Briefed one.' })],
  cut: [memory({ id: 'memory_c', handle: 'M-3', body: 'Cut one.' })],
  recalled: [
    memory({
      id: 'memory_r',
      handle: 'M-4',
      body: 'Recalled one.',
      standing: 'retired',
      retirement: {
        at: '2026-09-27T11:00:00.000Z',
        by: { id: 'user_2', name: 'Maya Chen' },
        reason: 'No longer true.',
        supersededBy: null,
      },
    }),
  ],
  proposed: [
    proposal({}),
    proposal({
      id: 'memory_k',
      body: 'Kept one.',
      state: 'approved',
      handle: 'M-5',
      standing: 'stands',
    }),
  ],
};

const showing = () =>
  render(
    <MemoryRouter>
      <RunRemembered slug="acme" teamId="team_1" runId="run_1" />
    </MemoryRouter>,
  );

const opened = async () => {
  showing();
  await userEvent.click(screen.getByRole('button', { name: /Remembered/ }));
};

beforeEach(() => {
  rememberedState.data = undefined;
  rememberedState.isPending = false;
  rememberedState.errorUpdateCount = 0;
  retire.mutate.mockReset();
});

describe('RunRemembered', () => {
  it('sums up what the run remembered before it is opened', () => {
    rememberedState.data = REMEMBERED;

    showing();

    expect(
      screen.getByText(
        '1 briefed · 1 cut by the cap · 1 recalled · 2 proposed',
      ),
    ).toBeVisible();
  });

  it('lists what was briefed, cut, recalled and proposed, marking the cut as cut and not briefed', async () => {
    rememberedState.data = REMEMBERED;

    await opened();

    const briefed = screen.getByRole('region', { name: 'Briefed' });
    const cut = screen.getByRole('region', { name: 'Cut by the cap' });
    expect(within(briefed).getByText('Briefed one.')).toBeInTheDocument();
    expect(within(briefed).queryByText('Cut one.')).toBeNull();
    expect(within(cut).getByText('Cut one.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Recalled' })).getByText(
        'Recalled one.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Waiting for a person')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'M-2' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/memory?memory=memory_b',
    );
  });

  it('offers to retire a memory that stands as wrong, never one already retired or still proposed', async () => {
    rememberedState.data = REMEMBERED;

    await opened();

    expect(
      screen.getAllByRole('button', { name: 'This was wrong' }),
    ).toHaveLength(3);

    await userEvent.click(
      within(screen.getByRole('region', { name: 'Briefed' })).getByRole(
        'button',
        { name: 'This was wrong' },
      ),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Why it no longer holds' }),
      'Branches follow the ticket now.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retire' }));

    expect(retire.mutate).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        memoryId: 'memory_b',
        reason: 'Branches follow the ticket now.',
      },
      expect.anything(),
    );
  });

  it('says so when the team remembered nothing for the run', () => {
    rememberedState.data = { briefed: [], cut: [], recalled: [], proposed: [] };

    showing();

    expect(
      screen.getByText('The team remembered nothing for this run.'),
    ).toBeVisible();
  });

  it('offers to try again when what the run remembered cannot be read', () => {
    rememberedState.errorUpdateCount = 1;

    showing();

    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible();
  });
});
