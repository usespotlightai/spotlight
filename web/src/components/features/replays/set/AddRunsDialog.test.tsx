import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddRunsDialog } from '@/components/features/replays/set/AddRunsDialog';
import type { ReplayableRun, ReplaySet, SuggestedRun } from '@/lib/replay';

const mutate = vi.fn();
const suggested = vi.fn((): SuggestedRun[] | undefined => []);
const failing = vi.fn(() => false);

vi.mock('@/hooks/api/useAddReplaySetEntry', () => ({
  useAddReplaySetEntry: () => ({
    mutate,
    isPending: false,
    reset: vi.fn(),
  }),
}));

const RECENT: ReplayableRun[] = [
  {
    runId: 'run_recent',
    taskId: 'task_recent',
    title: 'Split the invoice job',
    state: 'completed',
    endedAt: '2026-10-02T09:00:00.000Z',
    refusal: null,
    reason: null,
  },
];

vi.mock('@/hooks/api/useReplayableRuns', () => ({
  useReplayableRuns: () => ({
    data: RECENT,
    isPending: false,
    errorUpdateCount: 0,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useReplaySetSuggestions', () => ({
  useReplaySetSuggestions: () => ({
    data: suggested(),
    isPending: suggested() === undefined && !failing(),
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const SET = {
  id: 'set_1',
  name: 'Queue fixes',
  entries: [],
} as unknown as ReplaySet;

const SUGGESTION: SuggestedRun = {
  runId: 'run_accepted',
  taskId: 'task_accepted',
  title: 'Retry refunds on timeout',
  state: 'completed',
  endedAt: '2026-10-02T09:00:00.000Z',
  refusal: null,
  reason: null,
  outcome: 'accepted',
};

const renderDialog = () =>
  render(<AddRunsDialog at={AT} set={SET} open onOpenChange={vi.fn()} />);

describe('AddRunsDialog', () => {
  beforeEach(() => {
    mutate.mockReset();
    suggested.mockReturnValue([]);
    failing.mockReturnValue(false);
  });

  it('suggests runs that even the mix, saying how each turned out, and adds one only when asked', async () => {
    suggested.mockReturnValue([SUGGESTION]);
    renderDialog();

    const suggestions = screen.getByRole('list', {
      name: 'Suggested to even the mix',
    });

    expect(mutate).not.toHaveBeenCalled();
    expect(suggestions).toHaveTextContent('Retry refunds on timeout');
    expect(suggestions).toHaveTextContent('Accepted');
    expect(
      screen.getByText(
        'Recent runs with outcomes the set has few of. Nothing is added until you add it.',
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      within(suggestions).getByRole('button', {
        name: 'Add Retry refunds on timeout',
      }),
    );

    expect(mutate).toHaveBeenCalledWith({
      teamId: 'team_1',
      setId: 'set_1',
      runId: 'run_accepted',
    });
  });

  it('lists a suggested run once, among the suggestions', () => {
    suggested.mockReturnValue([{ ...RECENT[0], outcome: 'sent-back' }]);
    renderDialog();

    expect(screen.getAllByText('Split the invoice job')).toHaveLength(1);
    expect(
      screen.getByRole('list', { name: 'Suggested to even the mix' }),
    ).toHaveTextContent('Split the invoice job');
    expect(
      screen.queryByText(
        'No ended runs to replay yet. Runs appear here once they end.',
      ),
    ).not.toBeInTheDocument();
  });

  it('shows no suggestions when the mix needs none, and still lists recent runs', () => {
    renderDialog();

    expect(
      screen.queryByRole('list', { name: 'Suggested to even the mix' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'The station’s recent runs' }),
    ).toHaveTextContent('Split the invoice job');
  });

  it('shows suggestions loading, then failing to load, without hiding recent runs', () => {
    suggested.mockReturnValue(undefined);
    const { rerender } = renderDialog();

    expect(
      screen.getByRole('status', { name: 'Loading suggested runs' }),
    ).toBeInTheDocument();

    failing.mockReturnValue(true);
    rerender(<AddRunsDialog at={AT} set={SET} open onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Suggested runs/)).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'The station’s recent runs' }),
    ).toBeInTheDocument();
  });
});
