import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Task } from '@/routes/Task';

const task = {
  id: 'task_1',
  stationId: 'station_1',
  revision: 2,
  title: 'Fix the queue',
  description: '## Steps\n\nReproduce, then fix.',
  attachments: [],
  createdAt: '2026-08-04T09:15:00.000Z',
};

const worked = vi.fn((): unknown[] => []);
const journalled = vi.fn((): unknown[] => []);
const moved = vi.fn();
const deleted = vi.fn();
const listed = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();
const stacked = vi.fn((): unknown => ({ latest: null }));

vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({
    data: listed(),
    isPending: listed() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));
vi.mock('@/hooks/api/useMoveTask', () => ({
  useMoveTask: () => ({ mutate: moved }),
}));
vi.mock('@/hooks/api/useDeleteTask', () => ({
  useDeleteTask: () => ({ mutate: deleted }),
}));
vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useAssignTask', () => ({
  useAssignTask: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [
      {
        id: 'line_1',
        name: 'Default',
        stations: [
          { id: 'station_0', name: 'Backlog', position: 0, kind: 'backlog' },
          { id: 'station_1', name: 'Triage', position: 1, kind: 'work' },
          { id: 'station_2', name: 'Spec', position: 2, kind: 'work' },
          {
            id: 'station_3',
            name: 'Completed',
            position: 3,
            kind: 'completed',
          },
        ],
      },
    ],
    isPending: false,
    errorUpdateCount: 0,
  }),
}));
vi.mock('@/hooks/api/useTaskRuns', () => ({
  useTaskRuns: () => ({ data: worked() }),
}));
vi.mock('@/hooks/api/useTaskChangeStack', () => ({
  useTaskChangeStack: () => ({ data: stacked() }),
}));
vi.mock('@/hooks/api/useTaskJournal', () => ({
  useTaskJournal: () => ({ data: journalled() }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
  }),
}));

const renderAt = (taskId: string) =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/tasks/${taskId}`]}>
      <Routes>
        <Route path="/w/:slug/team/:teamId/tasks/:taskId" element={<Task />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  moved.mockClear();
  deleted.mockClear();
  worked.mockReturnValue([]);
  listed.mockReturnValue([task]);
  failing.mockReturnValue(false);
  refetch.mockClear();
  stacked.mockReturnValue({ latest: null });
});

const run = (over: Record<string, unknown> = {}) => ({
  id: 'run_1',
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  startedAt: '2026-08-30T09:00:00.000Z',
  updatedAt: '2026-08-30T09:00:56.000Z',
  harness: 'claude-code',
  station: {
    name: 'Implementation',
    color: '#edc12b',
    position: 3,
    count: 5,
  },
  review: null as { state: string; conversationId: string } | null,
  ...over,
});

describe('Task', () => {
  describe('the runs it has been through', () => {
    it('says nothing while none have been worked', () => {
      worked.mockReturnValue([]);
      renderAt('task_1');

      expect(screen.queryByText('Activity')).not.toBeInTheDocument();
    });

    it('heads the list once there are some', () => {
      worked.mockReturnValue([run(), run({ id: 'run_2' })]);
      renderAt('task_1');

      expect(
        screen.getByRole('heading', { name: 'Activity' }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('leads to the run’s own page', () => {
      worked.mockReturnValue([run()]);
      renderAt('task_1');

      expect(
        screen.getByRole('link', { name: /Implementation/ }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_1');
    });

    it('names the station each ran at', () => {
      worked.mockReturnValue([run()]);
      renderAt('task_1');

      expect(screen.getByText('Implementation')).toBeInTheDocument();
    });

    it('marks each run that put the task to a person', () => {
      worked.mockReturnValue([
        run({ review: { state: 'owed', conversationId: 'task_1:5' } }),
        run({ id: 'run_2' }),
        run({
          id: 'run_3',
          review: { state: 'settled', conversationId: 'task_1:0' },
        }),
      ]);
      renderAt('task_1');

      expect(screen.getAllByText('Waiting for you')).toHaveLength(1);
      expect(screen.getByText('Answered')).toBeInTheDocument();
    });

    it('opens the conversation where that run asked', () => {
      worked.mockReturnValue([
        run({
          id: 'run_7',
          review: { state: 'owed', conversationId: 'task_1:5' },
        }),
      ]);
      renderAt('task_1');

      expect(
        screen.getByRole('link', { name: /Waiting for you/ }),
      ).toHaveAttribute('href', '/w/acme/inbox/task_1%3A5?run=run_7');
    });

    it('says nothing of a review where none was asked for', () => {
      worked.mockReturnValue([run()]);
      renderAt('task_1');

      expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
    });

    it('puts the asking above the run that raised it', () => {
      worked.mockReturnValue([
        run({ id: 'run_2' }),
        run({ review: { state: 'owed', conversationId: 'task_1:5' } }),
      ]);
      renderAt('task_1');

      const told = screen
        .getAllByRole('listitem')
        .map((each) => each.textContent);

      expect(told[1]).toContain('Waiting for you');
      expect(told[2]).toContain('Implementation');
    });
  });

  it('links the changes of the newest stack drafted for the task', () => {
    stacked.mockReturnValue({
      latest: {
        runId: 'run_9',
        repository: 'spotlight',
        state: 'ready',
        checkState: 'checked',
        added: 61,
        removed: 4,
      },
    });
    renderAt('task_1');

    const changes = screen.getByRole('link', { name: /Changes/ });

    expect(changes).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/runs/run_9/changes?repository=spotlight',
    );
    expect(changes).toHaveTextContent('+61');
    expect(changes).toHaveTextContent('−4');
  });

  it('offers no change stack where none was drafted', () => {
    renderAt('task_1');

    expect(
      screen.queryByRole('link', { name: /Changes/ }),
    ).not.toBeInTheDocument();
  });

  it('leads with the task title', () => {
    renderAt('task_1');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Fix the queue' }),
    ).toBeInTheDocument();
  });

  it('names the line it came from in the breadcrumbs', () => {
    renderAt('task_1');

    expect(screen.getByRole('link', { name: 'Default' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });

  it('names the station it stands at', () => {
    renderAt('task_1');

    expect(screen.getByRole('button', { name: /Station/ })).toHaveTextContent(
      'Triage',
    );
  });

  it('moves the task to a station picked from the sidebar', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: /Station/ }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitemradio', { name: 'Backlog' }));

    expect(moved).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      taskId: 'task_1',
      revision: 2,
      stationId: 'station_0',
      afterTaskId: null,
    });
  });

  it('offers only the backlog, completed and where it stands to a task at a work station', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: /Station/ }));
    await screen.findByRole('menu');

    expect(
      screen.getAllByRole('menuitemradio').map((each) => each.textContent),
    ).toEqual(['Backlog', 'Triage', 'Completed']);
  });

  it('offers nothing to move to once a task is completed', async () => {
    const user = userEvent.setup();
    listed.mockReturnValue([{ ...task, stationId: 'station_3' }]);
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: /Station/ }));
    await screen.findByRole('menu');

    expect(
      screen.getAllByRole('menuitemradio').map((each) => each.textContent),
    ).toEqual(['Completed']);
  });

  it('asks before taking a task away', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: 'Task options' }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitem', { name: /Delete task/ }));

    expect(
      await screen.findByRole('heading', { name: /Delete/ }),
    ).toBeInTheDocument();
    expect(deleted).not.toHaveBeenCalled();
  });

  it('takes the task away once it is asked to', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: 'Task options' }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitem', { name: /Delete task/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Delete task' }),
    );

    expect(deleted).toHaveBeenCalledWith(
      { teamId: 'team_1', taskId: 'task_1' },
      expect.anything(),
    );
  });

  it('keeps the task when the asking is declined', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: 'Task options' }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitem', { name: /Delete task/ }));
    await user.click(await screen.findByRole('button', { name: 'Keep it' }));

    expect(deleted).not.toHaveBeenCalled();
  });

  it('says so when there is no task at that address', () => {
    renderAt('task_missing');

    expect(
      screen.getByRole('heading', { name: 'Task not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the team' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
  });

  it('holds the shape of a task while it loads, keeping what never changes', () => {
    listed.mockReturnValue(undefined);

    renderAt('task_1');

    expect(
      screen.getByRole('status', { name: 'Loading the task' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Properties' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Task not found' }),
    ).not.toBeInTheDocument();
  });

  it('says the task could not be loaded, and tries again when asked', async () => {
    const user = userEvent.setup();
    listed.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    renderAt('task_1');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The task could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the task up when a later refresh fails', () => {
    failing.mockReturnValue(true);

    renderAt('task_1');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Fix the queue' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
