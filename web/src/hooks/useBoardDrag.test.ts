import type { DragEndEvent } from '@dnd-kit/core';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBoardDrag } from '@/hooks/useBoardDrag';
import type { StationResponseDto } from '@/lib/api';
import type { Task } from '@/lib/task';

const moved = vi.fn();

vi.mock('@/hooks/api/useMoveTask', () => ({
  useMoveTask: () => ({ mutate: moved }),
}));

const stations = [
  { id: 'backlog', name: 'Backlog', kind: 'backlog' },
  { id: 'build', name: 'Build', kind: 'work' },
  { id: 'completed', name: 'Completed', kind: 'completed' },
] as StationResponseDto[];

const task = (over: Partial<Task> = {}) =>
  ({
    id: 'task_1',
    stationId: 'build',
    revision: 3,
    title: 'Fix the queue',
    progress: null,
    hold: null,
    ...over,
  }) as Task;

const dropped = (stationId: string) =>
  ({
    active: { id: 'task_1', data: { current: { kind: 'task' } } },
    over: { id: stationId, data: { current: { kind: 'station', stationId } } },
  }) as unknown as DragEndEvent;

const boardWith = (moving: Task) =>
  renderHook(() =>
    useBoardDrag({
      teamId: 'team_1',
      lineId: 'line_1',
      tasks: [moving],
      stations,
    }),
  ).result;

const MOVE = {
  teamId: 'team_1',
  lineId: 'line_1',
  taskId: 'task_1',
  revision: 3,
  stationId: 'completed',
  afterTaskId: null,
};

describe('useBoardDrag', () => {
  beforeEach(() => moved.mockClear());

  it('moves a task that no run works to the completed station at once', () => {
    const board = boardWith(task());

    act(() => board.current.handlers.onDragEnd(dropped('completed')));

    expect(moved).toHaveBeenCalledWith(MOVE);
    expect(board.current.stopping).toBeNull();
  });

  it('asks before it moves a task in progress to the completed station', () => {
    const board = boardWith(task({ progress: 'in-progress' }));

    act(() => board.current.handlers.onDragEnd(dropped('completed')));

    expect(moved).not.toHaveBeenCalled();
    expect(board.current.stopping?.task.id).toBe('task_1');
  });

  it('moves the task in progress once the person confirms', () => {
    const board = boardWith(task({ progress: 'in-progress' }));

    act(() => board.current.handlers.onDragEnd(dropped('completed')));
    act(() => board.current.confirmStop());

    expect(moved).toHaveBeenCalledWith(MOVE);
    expect(board.current.stopping).toBeNull();
  });

  it('leaves the task in progress where it is when the person declines', () => {
    const board = boardWith(task({ progress: 'in-progress' }));

    act(() => board.current.handlers.onDragEnd(dropped('completed')));
    act(() => board.current.cancelStop());

    expect(moved).not.toHaveBeenCalled();
    expect(board.current.stopping).toBeNull();
  });
});
