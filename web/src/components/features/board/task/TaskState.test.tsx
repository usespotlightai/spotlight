import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TaskState } from '@/components/features/board/task/TaskState';
import type { Task } from '@/lib/task';

const task = (over: Partial<Task> = {}) =>
  ({
    id: 'task_1',
    stationId: 'station_1',
    title: 'Fix the queue',
    description: null,
    createdAt: '2026-08-28T09:15:00.000Z',
    work: null,
    awaitingReview: null,
    note: null,
    ...over,
  }) as Task;

const renderIn = (ui: ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('TaskState', () => {
  it('says nothing about a task that is simply waiting its turn', () => {
    const { container } = renderIn(<TaskState task={task()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('marks a task a runner is working', () => {
    renderIn(<TaskState task={task({ work: 'in-progress' })} />);

    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('marks a task whose run waits for a runner as queued, not in progress', () => {
    renderIn(<TaskState task={task({ work: 'queued' })} />);

    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('marks a task that is waiting on a person', () => {
    renderIn(
      <TaskState
        task={task({ awaitingReview: { conversationId: 'task_1:5' } })}
      />,
    );

    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
  });

  it('leads to the conversation waiting on them', () => {
    renderIn(
      <TaskState
        task={task({ awaitingReview: { conversationId: 'task_1:5' } })}
        reviewTo="/w/acme/inbox/task_1%3A5"
      />,
    );

    expect(
      screen.getByRole('link', { name: /Waiting for you/ }),
    ).toHaveAttribute('href', '/w/acme/inbox/task_1%3A5');
  });

  it('asks for a person ahead of saying it is being worked', () => {
    renderIn(
      <TaskState
        task={task({
          work: 'in-progress',
          awaitingReview: { conversationId: 'task_1:5' },
        })}
      />,
    );

    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });
});
