import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceList } from '@/components/features/trace/list/TraceList';
import type { InsightsTrace, RunFilter } from '@/lib/insights';

const traces = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useInsightsTraces', () => ({
  useInsightsTraces: () => ({
    data: traces() && {
      range: '7d',
      from: '2026-08-22T12:00:00.000Z',
      to: '2026-08-29T12:00:00.000Z',
      volume: [],
      traces: traces(),
      matched: 1,
      truncated: false,
      people: [{ personId: 'user_ada', name: 'Ada Lovelace' }],
    },
    isPending: traces() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [{ id: 'line_1', name: 'Delivery', stations: [] }],
  }),
}));

vi.mock('@/components/features/trace/list/TraceVolume', () => ({
  TraceVolume: () => null,
}));

const IMPLEMENTATION = {
  stationId: 'station_1',
  name: 'Implementation',
  color: '#edc12b',
  position: 1,
  count: 3,
};

const traced: InsightsTrace = {
  taskId: 'task_1',
  title: 'Drain the stuck retry queues',
  input: null,
  output: null,
  station: IMPLEMENTATION,
  stations: [IMPLEMENTATION],
  startedAt: new Date().toISOString(),
  ms: 12_000,
  errors: 0,
  cost: { amount: 0.42, currency: 'USD' },
  total: 1,
  runs: [
    {
      runId: 'run_1',
      station: IMPLEMENTATION,
      progress: null,
      ending: 'failed',
      failure: 'timed-out',
      openedBy: 'user_ada',
      harness: 'claude-code',
      model: 'opus',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      ms: 12_000,
      errors: 2,
      cost: { amount: 0.42, currency: 'USD' },
    },
  ],
};

const everyTrace = vi.fn();

function HandedOver() {
  const { state } = useLocation();

  return <pre>{JSON.stringify(state.traces)}</pre>;
}

const showing = (filter: RunFilter = {}) =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/insights']}>
      <Routes>
        <Route
          path="/w/acme/team/team_1/insights"
          element={
            <TraceList
              slug="acme"
              teamId="team_1"
              range="7d"
              filter={filter}
              onEveryTrace={everyTrace}
            />
          }
        />
        <Route path="/w/acme/team/team_1/agent" element={<HandedOver />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  traces.mockReturnValue([traced]);
  failing.mockReturnValue(false);
  refetch.mockClear();
  everyTrace.mockClear();
});

describe('TraceList', () => {
  it('lists each traced task, leading to its trace', () => {
    showing();

    expect(
      screen.getByRole('link', { name: 'Drain the stuck retry queues' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/tasks/task_1/trace');
  });

  it('says how many of the runs of each trace match when narrowed', () => {
    traces.mockReturnValue([{ ...traced, total: 3 }]);
    showing({ outcome: 'failed' });

    expect(screen.getByText('1 of 3 runs')).toBeInTheDocument();
  });

  it('says no trace matches, and shows every trace on request', async () => {
    traces.mockReturnValue([]);
    showing({ outcome: 'failed' });

    expect(screen.getByText('No traces match.')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Show every trace' }),
    );

    expect(everyTrace).toHaveBeenCalled();
  });

  it('takes the selected traces to a new chat with the agent', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select Drain the stuck retry queues',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Discuss with the agent' }),
    );

    expect(JSON.parse(screen.getByText(/task_1/).textContent ?? '[]')).toEqual([
      { taskId: 'task_1', title: 'Drain the stuck retry queues' },
    ]);
  });

  it('keeps the shape of a trace while they load, keeping the column names', () => {
    traces.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the traces' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.queryByText('No traces')).not.toBeInTheDocument();
  });

  it('says the traces could not be loaded, and tries again on request', async () => {
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
      screen.getByText(/No traces in the past 7 days/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
    expect(screen.queryByText('Started')).not.toBeInTheDocument();
  });
});
