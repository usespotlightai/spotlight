import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BlockedByPicker } from '@/components/features/board/task/BlockedByPicker';
import type { Task } from '@/lib/task';
import { partial } from '@/test/partial';

const blocked = vi.fn();

const task = (over: Partial<Task> = {}) =>
  partial<Task>({
    id: 'task_2',
    stationId: 'station_backlog',
    title: 'Web 2/4',
    finished: false,
    blockedBy: [],
    blockable: true,
    ...over,
  });

const BOARD = [
  task({ id: 'task_1', title: 'Web 1/4' }),
  task(),
  task({ id: 'task_0', title: 'Shipped', finished: true }),
];

vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({ data: BOARD }),
}));
vi.mock('@/hooks/api/useBlockTask', () => ({
  useBlockTask: () => ({ mutate: blocked }),
}));

describe('BlockedByPicker', () => {
  beforeEach(() => {
    blocked.mockClear();
  });

  it('blocks the task by another open task of the team', async () => {
    render(<BlockedByPicker teamId="team_1" task={task()} />);

    expect(screen.getByText('Not blocked')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Blocked by' }));

    expect(
      screen.queryByRole('menuitemcheckbox', { name: 'Shipped' }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Web 1/4' }),
    );

    expect(blocked).toHaveBeenCalledWith({
      teamId: 'team_1',
      taskId: 'task_2',
      blockedBy: [{ id: 'task_1', title: 'Web 1/4', teamId: 'team_1' }],
    });
  });

  it('clears a blocker it has', async () => {
    const blocker = { id: 'task_1', title: 'Web 1/4', teamId: 'team_1' };

    render(
      <BlockedByPicker teamId="team_1" task={task({ blockedBy: [blocker] })} />,
    );

    expect(screen.getByText('Blocked by Web 1/4')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Blocked by' }));
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Web 1/4' }),
    );

    expect(blocked).toHaveBeenCalledWith({
      teamId: 'team_1',
      taskId: 'task_2',
      blockedBy: [],
    });
  });

  it('cannot block a task that has started', () => {
    render(
      <BlockedByPicker teamId="team_1" task={task({ blockable: false })} />,
    );

    expect(screen.getByRole('button', { name: 'Blocked by' })).toBeDisabled();
  });
});
