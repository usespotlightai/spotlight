import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceList } from '@/components/features/trace/list/TraceList';
import type { Traced } from '@/lib/trace-list';

const traces = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useTeamTraces', () => ({
  useTeamTraces: () => ({
    data: traces(),
    isPending: traces() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useAnalyseTraces', () => ({
  useAnalyseTraces: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [{ id: 'line_1', name: 'Delivery', stations: [] }],
  }),
}));

vi.mock('@/components/features/trace/list/TraceVolume', () => ({
  TraceVolume: () => null,
}));

const traced: Traced = {
  taskId: 'task_1',
  title: 'Drain the stuck retry queues',
  station: null,
  stations: [],
  harness: 'claude-code',
  state: 'completed',
  startedAt: new Date().toISOString(),
  runs: 1,
  input: null,
  output: null,
  ms: 12_000,
  steps: 4,
  faults: 0,
  cost: 0.42,
  currency: 'USD',
};

const showing = () =>
  render(
    <MemoryRouter>
      <TraceList slug="acme" teamId="team_1" range="7d" />
    </MemoryRouter>,
  );

beforeEach(() => {
  traces.mockReturnValue([traced]);
  failing.mockReturnValue(false);
  refetch.mockClear();
});

describe('TraceList', () => {
  it('lists each traced task, leading to its trace', () => {
    showing();

    expect(
      screen.getByRole('link', { name: 'Drain the stuck retry queues' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/observability/tasks/task_1');
  });

  it('holds the shape of a trace while they load, keeping the column names', () => {
    traces.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the traces' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.queryByText('No traces')).not.toBeInTheDocument();
  });

  it('says the traces could not be loaded, and tries again when asked', async () => {
    traces.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Traces could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the traces it has when a later refresh fails', () => {
    failing.mockReturnValue(true);
    showing();

    expect(
      screen.getByText('Drain the stuck retry queues'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says nothing was traced in the range, and sends you to create a task', () => {
    traces.mockReturnValue([]);
    showing();

    expect(screen.getByText('No traces')).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing was traced in the past 7 days/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
    expect(screen.queryByText('Started')).not.toBeInTheDocument();
  });
});
