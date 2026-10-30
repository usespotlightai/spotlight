import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TaskState } from '@/components/features/board/task/TaskState';
import { RunRow } from '@/components/features/runs/RunRow';
import type { Run } from '@/lib/run';
import type { Task } from '@/lib/task';
import { progressOfState } from '@/mocks/world/run-progress';

const run = (state: Run['state'], review: Run['review'] = null) =>
  ({
    id: 'run_1',
    state,
    progress: progressOfState(state),
    exitCode: null,
    startedAt: new Date().toISOString(),
    station: null,
    review,
  }) as unknown as Run;

const PENDING = { state: 'pending', conversationId: 'task_1:3' } as const;

const shown = (ui: React.ReactNode) => {
  const { container } = render(<MemoryRouter>{ui}</MemoryRouter>);

  return container;
};

describe('RunRow, what a run is doing', () => {
  it('shows the same pill that a task in progress shows on the board', () => {
    const inRuns = shown(<RunRow run={run('claimed')} to="/runs/run_1" />);
    const onBoard = shown(
      <TaskState
        task={
          { progress: 'in-progress', awaitingReview: false } as unknown as Task
        }
      />,
    );

    const pill = (container: HTMLElement) =>
      screen
        .getAllByText('In progress')
        .find((each) => container.contains(each))?.outerHTML;

    expect(pill(inRuns)).toBeDefined();
    expect(pill(inRuns)).toEqual(pill(onBoard));
  });

  it('shows the same queued pill that a queued task shows on the board', () => {
    const inRuns = shown(<RunRow run={run('queued')} to="/runs/run_1" />);
    const onBoard = shown(
      <TaskState
        task={
          {
            progress: 'queued',
            awaitingReview: false,
          } as unknown as Task
        }
      />,
    );

    const pill = (container: HTMLElement) =>
      screen.getAllByText('Queued').find((each) => container.contains(each))
        ?.outerHTML;

    expect(pill(inRuns)).toBeDefined();
    expect(pill(inRuns)).toEqual(pill(onBoard));
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('says nothing of a run that has ended', () => {
    shown(<RunRow run={run('completed')} to="/runs/run_1" />);

    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Queued')).not.toBeInTheDocument();
  });

  it('says a run that asked a person is waiting for you, neither in progress nor queued', () => {
    shown(<RunRow run={run('suspended')} to="/runs/run_1" />);

    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Queued')).not.toBeInTheDocument();
  });

  it('leads from waiting for you to where the person answers', () => {
    shown(
      <RunRow
        run={run('suspended', PENDING)}
        to="/runs/run_1"
        reviewTo="/inbox/task_1:3"
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Waiting for you' }),
    ).toHaveAttribute('href', '/inbox/task_1:3');
  });

  it('says waiting for you for a run that is over and still waits for an answer', () => {
    shown(
      <RunRow
        run={run('completed', PENDING)}
        to="/runs/run_1"
        reviewTo="/inbox/task_1:3"
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Waiting for you' }),
    ).toHaveAttribute('href', '/inbox/task_1:3');
  });
});
