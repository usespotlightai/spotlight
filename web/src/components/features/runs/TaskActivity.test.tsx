import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { TaskActivity } from '@/components/features/runs/TaskActivity';
import type { Run } from '@/lib/run';

const runs = vi.fn<() => Run[]>();

vi.mock('@/hooks/api/useTaskRuns', () => ({
  useTaskRuns: () => ({ data: runs() }),
}));

vi.mock('@/hooks/api/useStopRun', () => ({
  useStopRun: () => ({ mutate: () => {} }),
  useStopInFlight: () => false,
}));

const run = (review: Run['review'], waitingForYou: boolean) =>
  ({
    id: 'run_1',
    driver: 'line',
    state: 'completed',
    progress: null,
    attempt: 1,
    exitCode: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    harness: 'claude-code',
    image: null,
    station: null,
    review,
    waitingForYou,
  }) as Run;

const PENDING = { state: 'pending', conversationId: 'task_1:3' } as const;

const shown = () =>
  render(
    <MemoryRouter>
      <TaskActivity slug="acme" teamId="team_1" taskId="task_1" hold={null} />
    </MemoryRouter>,
  );

describe('TaskActivity', () => {
  it('says a question waits for you when the answer is yours', () => {
    runs.mockReturnValue([run(PENDING, true)]);
    shown();

    expect(
      screen.getByRole('link', { name: /Waiting for you/ }),
    ).toHaveAttribute('href', expect.stringContaining('/w/acme/inbox/'));
  });

  it('leaves out a question that waits for someone else', () => {
    runs.mockReturnValue([run(PENDING, false)]);
    shown();

    expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
  });

  it('shows an answered question to everyone', () => {
    runs.mockReturnValue([
      run({ state: 'answered', conversationId: 'task_1:3' }, false),
    ]);
    shown();

    expect(screen.getByText('Answered')).toBeInTheDocument();
  });

  it('says the task moved on where nobody answered the question', () => {
    runs.mockReturnValue([
      run({ state: 'moved-on', conversationId: 'task_1:3' }, false),
    ]);
    shown();

    expect(screen.getByText('Moved on without an answer')).toBeInTheDocument();
    expect(screen.queryByText('Answered')).not.toBeInTheDocument();
  });
});
