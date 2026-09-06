import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TaskState } from '@/components/features/board/task/TaskState';
import { RunRow } from '@/components/features/runs/RunRow';
import type { Run } from '@/lib/run';
import type { Task } from '@/lib/task';

const run = (state: Run['state']) =>
  ({
    id: 'run_1',
    state,
    exitCode: null,
    startedAt: new Date().toISOString(),
    station: null,
    review: null,
  }) as unknown as Run;

const shown = (ui: React.ReactNode) => {
  const { container } = render(<MemoryRouter>{ui}</MemoryRouter>);

  return container;
};

describe('RunRow, what a run is doing', () => {
  it('wears the same thing a task being worked wears on the board', () => {
    const inRuns = shown(<RunRow run={run('claimed')} to="/runs/run_1" />);
    const onBoard = shown(
      <TaskState
        task={{ running: true, awaitingReview: false } as unknown as Task}
      />,
    );

    const pill = (container: HTMLElement) =>
      screen
        .getAllByText('In progress')
        .find((each) => container.contains(each))?.outerHTML;

    expect(pill(inRuns)).toBeDefined();
    expect(pill(inRuns)).toEqual(pill(onBoard));
  });

  it('says a queued run is queued, which the board has no word for', () => {
    shown(<RunRow run={run('queued')} to="/runs/run_1" />);

    expect(screen.getByText('Queued')).toBeInTheDocument();
  });

  it('says nothing of a run that has ended', () => {
    shown(<RunRow run={run('completed')} to="/runs/run_1" />);

    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Queued')).not.toBeInTheDocument();
  });
});
