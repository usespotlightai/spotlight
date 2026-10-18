import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunRemembered } from '@/components/features/runs/remembered/RunRemembered';
import type { RunMemories, RunProposal, TeamMemory } from '@/lib/memory';
import { WithRunSidePanel } from '@/test/WithRunSidePanel';

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
};

vi.mock('@/hooks/api/useRunMemories', () => ({
  useRunMemories: () => rememberedState,
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { name: 'Ada Lovelace', image: null } } }),
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
  status: 'active',
  scope: 'team',
  lineId: null,
  stationId: null,
  repository: null,
  paths: [],
  approvedBy: { id: 'user_2', name: 'Maya Chen', image: null },
  approvedAt: '2026-09-27T10:00:00.000Z',
  supersedes: null,
  retirement: null,
  provenance: null,
  runs: 1,
  ...over,
});

const proposal = (over: Partial<RunProposal>): RunProposal => ({
  id: 'memory_p',
  kind: 'failure',
  body: 'The worker test hangs without Redis.',
  source: 'run',
  proposedBy: 'agent',
  state: 'proposed',
  scope: 'line',
  repository: null,
  paths: [],
  supersedes: null,
  decision: null,
  harness: null,
  steps: [],
  notes: [],
  handle: null,
  status: null,
  ...over,
});

const REMEMBERED: RunMemories = {
  briefed: [memory({ id: 'memory_b', handle: 'M-2', body: 'Briefed one.' })],
  omitted: [memory({ id: 'memory_c', handle: 'M-3', body: 'Cut one.' })],
  recalled: [
    memory({
      id: 'memory_r',
      handle: 'M-4',
      body: 'Recalled one.',
      status: 'retired',
      retirement: {
        at: '2026-09-27T11:00:00.000Z',
        by: { id: 'user_2', name: 'Maya Chen', image: null },
        reason: 'No longer true.',
        supersededBy: null,
      },
    }),
  ],
  proposed: [
    proposal({}),
    proposal({
      id: 'memory_k',
      body: 'Approved one.',
      state: 'approved',
      handle: 'M-5',
      status: 'active',
    }),
  ],
  reviewItemId: 'request_1',
};

const showing = () =>
  render(
    <MemoryRouter>
      <WithRunSidePanel>
        <RunRemembered slug="acme" teamId="team_1" runId="run_1" />
      </WithRunSidePanel>
    </MemoryRouter>,
  );

const opened = async () => {
  showing();
  await userEvent.click(screen.getByRole('button', { name: 'Memories' }));
};

beforeEach(() => {
  rememberedState.data = undefined;
  rememberedState.isPending = false;
  rememberedState.errorUpdateCount = 0;
  retire.mutate.mockReset();
});

describe('RunRemembered', () => {
  it('sums up what the run remembered when pointed at', async () => {
    rememberedState.data = REMEMBERED;

    showing();
    await userEvent.hover(screen.getByRole('button', { name: 'Memories' }));

    const shown = (await screen.findAllByRole('term')).map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]);
    expect(shown).toEqual([
      ['Supplied', '2'],
      ['Proposed', '2'],
    ]);
  });

  it('opens what the run remembered in a side panel, not in place', async () => {
    rememberedState.data = REMEMBERED;

    showing();
    const summary = screen.getByRole('button', { name: 'Memories' });
    expect(summary).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByRole('complementary')).toBeNull();

    await userEvent.click(summary);

    expect(summary).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(screen.getByRole('complementary')).getByRole('region', {
        name: 'Supplied to the agent',
      }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Close the run’s memories' }),
    );

    expect(summary).toHaveAttribute('aria-pressed', 'false');
  });

  it('lists what the agent was supplied, without saying how it came by it, and what the run proposed, leaving out what the cap omitted', async () => {
    rememberedState.data = REMEMBERED;

    await opened();

    const supplied = screen.getByRole('region', {
      name: 'Supplied to the agent',
    });
    expect(within(supplied).queryByText('Recalled')).toBeNull();
    expect(within(supplied).getByText('Briefed one.')).toBeInTheDocument();
    expect(within(supplied).getByText('Recalled one.')).toBeInTheDocument();
    expect(screen.queryByText('Cut one.')).toBeNull();
    expect(
      within(
        screen.getByRole('region', { name: 'Proposed by this run' }),
      ).getByRole('link', { name: 'Waiting for you' }),
    ).toHaveAttribute('href', '/w/acme/inbox/request_1');
    expect(screen.getByRole('link', { name: 'M-2' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/memory?memory=memory_b',
    );
  });

  it('shows who retired a memory and why, as their message', async () => {
    rememberedState.data = REMEMBERED;

    await opened();

    const why = screen.getByRole('figure', { name: 'Why it was retired' });
    expect(within(why).getByText('Maya Chen')).toBeInTheDocument();
    expect(within(why).getByText('retired this')).toBeInTheDocument();
    expect(within(why).getByText('No longer true.')).toBeInTheDocument();
  });

  it('puts the button back when the person thinks better of it', async () => {
    rememberedState.data = REMEMBERED;

    await opened();
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'This was wrong',
      })[0] as HTMLElement,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('form', { name: 'Retire this memory' }),
      ).toBeNull(),
    );
    expect(
      screen.getAllByRole('button', { name: 'This was wrong' }),
    ).toHaveLength(2);
  });

  it('offers to retire an active memory as wrong, never one already retired or still proposed', async () => {
    rememberedState.data = REMEMBERED;

    await opened();

    expect(
      screen.getAllByRole('button', { name: 'This was wrong' }),
    ).toHaveLength(2);

    const card = within(
      screen.getByRole('region', { name: 'Supplied to the agent' }),
    ).getAllByRole('listitem')[0] as HTMLElement;
    await userEvent.click(
      within(card).getByRole('button', { name: 'This was wrong' }),
    );

    const replying = within(card).getByRole('form', {
      name: 'Retire this memory',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(replying).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(replying).getByText('retiring this')).toBeInTheDocument();
    expect(
      within(card).queryByRole('button', { name: 'This was wrong' }),
    ).toBeNull();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Why it no longer applies' }),
      'Branches follow the ticket now.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retire' }));

    expect(retire.mutate).toHaveBeenCalledWith({
      teamId: 'team_1',
      memoryId: 'memory_b',
      reason: 'Branches follow the ticket now.',
    });
  });

  it('can be opened while what the run remembered is still loading', async () => {
    rememberedState.isPending = true;

    await opened();

    expect(
      screen.getByRole('status', { name: 'Loading what the run remembered' }),
    ).toBeInTheDocument();
  });

  it('stays out of the way when the cap omitted all the run had', () => {
    rememberedState.data = {
      briefed: [],
      omitted: [memory({ id: 'memory_c' })],
      recalled: [],
      proposed: [],
    };

    showing();

    expect(screen.queryByRole('button', { name: 'Memories' })).toBeNull();
  });

  it('stays out of the way when the team remembered nothing for the run', () => {
    rememberedState.data = {
      briefed: [],
      omitted: [],
      recalled: [],
      proposed: [],
    };

    showing();

    expect(screen.queryByRole('button', { name: 'Memories' })).toBeNull();
  });

  it('offers to try again when what the run remembered cannot be read', async () => {
    rememberedState.errorUpdateCount = 1;

    await opened();

    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible();
  });
});
