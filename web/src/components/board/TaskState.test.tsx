import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TaskState } from '@/components/board/TaskState';
import type { Task } from '@/lib/task';

const task = (over: Partial<Task> = {}) =>
  ({
    id: 'task_1',
    stationId: 'station_1',
    title: 'Fix the queue',
    description: null,
    createdAt: '2026-08-28T09:15:00.000Z',
    running: false,
    awaitingReview: false,
    note: null,
    ...over,
  }) as Task;

describe('TaskState', () => {
  it('says nothing about a task that is simply waiting its turn', () => {
    const { container } = render(<TaskState task={task()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('marks a task a runner is working', () => {
    render(<TaskState task={task({ running: true })} />);

    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('marks a task that is waiting on a person', () => {
    render(<TaskState task={task({ awaitingReview: true })} />);

    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
  });

  // A run that ended by asking for a person leaves both true until someone
  // looks, and the one that wants doing is the one to show.
  it('asks for a person ahead of saying it is being worked', () => {
    render(<TaskState task={task({ running: true, awaitingReview: true })} />);

    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });
});
