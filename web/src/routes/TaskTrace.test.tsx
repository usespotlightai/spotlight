import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskTrace } from '@/routes/TaskTrace';

const listed = vi.fn();
const traced = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({
    data: listed(),
    isPending: listed() === undefined,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useRunScores', () => ({
  useRunScores: () => ({
    data: undefined,
    isPending: true,
    isFetching: false,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useTaskTrace', () => ({
  useTaskTrace: () => ({
    data: traced(),
    isPending: traced() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

const AT = '2026-08-29T12:00:00.000Z';

const run = {
  id: 'run:run_1',
  kind: 'run',
  name: 'Implementation',
  startedAt: AT,
  ms: 60_000,
  category: 'agent',
  cost: null,
  currency: null,
  step: null,
  span: null,
  children: [],
};

const trace = (roots: unknown[]) => ({
  startedAt: roots.length > 0 ? AT : null,
  ms: roots.length > 0 ? 60_000 : 0,
  rows: roots.length,
  errors: 0,
  roots,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/tasks/task_1/trace']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/tasks/:taskId/trace"
          element={<TaskTrace />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('TaskTrace', () => {
  beforeEach(() => {
    listed.mockReturnValue([{ id: 'task_1', title: 'Fix the queue' }]);
    traced.mockReturnValue(trace([run]));
    failing.mockReturnValue(false);
    refetch.mockClear();
  });

  it('lays out the runs the task has been through', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: /Fix the queue/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Implementation')).toBeInTheDocument();
  });

  it('keeps the shape of the trace while it loads, keeping the way back', () => {
    traced.mockReturnValue(undefined);

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Loading the trace' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix the queue' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/tasks/task_1',
    );
    expect(screen.queryByText('No runs yet')).not.toBeInTheDocument();
  });

  it('keeps the place of the task’s name until the task has loaded', () => {
    listed.mockReturnValue(undefined);

    renderPage();

    expect(screen.queryByText('Task')).not.toBeInTheDocument();
    expect(screen.queryByText('Trace')).not.toBeInTheDocument();
    expect(screen.getByText('Implementation')).toBeInTheDocument();
  });

  it('says the trace could not be loaded, and tries again on request', async () => {
    const person = userEvent.setup();
    traced.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The trace could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the trace up when a later refresh fails', () => {
    failing.mockReturnValue(true);

    renderPage();

    expect(screen.getByText('Implementation')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so when nothing has run against the task, and leads back to it', () => {
    traced.mockReturnValue(trace([]));

    renderPage();

    expect(screen.getByText('No runs yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/tasks/task_1',
    );
  });
});
