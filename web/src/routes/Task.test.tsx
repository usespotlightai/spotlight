import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Task } from '@/routes/Task';

const task = {
  id: 'task_1',
  stationId: 'station_1',
  title: 'Fix the queue',
  description: '## Steps\n\nReproduce, then fix.',
  createdAt: '2026-08-04T09:15:00.000Z',
};

const moved = vi.fn();
const deleted = vi.fn();

vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({ data: [task], isPending: false }),
}));
vi.mock('@/hooks/api/useMoveTask', () => ({
  useMoveTask: () => ({ mutate: moved }),
}));
vi.mock('@/hooks/api/useDeleteTask', () => ({
  useDeleteTask: () => ({ mutate: deleted }),
}));
vi.mock('@/hooks/api/useAssemblyLines', () => ({
  useAssemblyLines: () => ({
    data: [
      {
        id: 'line_1',
        name: 'Default',
        stations: [
          { id: 'station_0', name: 'Backlog', position: 0 },
          { id: 'station_1', name: 'Triage', position: 1 },
        ],
      },
    ],
    isPending: false,
  }),
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
  moved.mockClear();
  deleted.mockClear();
});

describe('Task', () => {
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
      stationId: 'station_0',
      afterTaskId: null,
    });
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
  });
});
