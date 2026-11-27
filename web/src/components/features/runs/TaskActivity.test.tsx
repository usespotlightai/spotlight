import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { TaskActivity } from '@/components/features/runs/TaskActivity';
import type { NoteResponseDto } from '@/lib/api';
import type { Run } from '@/lib/run';
import { partial } from '@/test/partial';

const runs = vi.fn<() => Run[]>();
const moves = vi.fn<() => NoteResponseDto[]>(() => []);

vi.mock('@/hooks/api/useTaskRuns', () => ({
  useTaskRuns: () => ({ data: runs() }),
}));

vi.mock('@/hooks/api/useTaskMoves', () => ({
  useTaskMoves: () => ({ data: moves() }),
}));

vi.mock('@/hooks/api/useStopRun', () => ({
  useStopRun: () => ({ mutate: () => {} }),
  useStopInFlight: () => false,
}));

const run = (review: Run['review'], waitingForYou: boolean) =>
  partial<Run>({
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
  });

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

  it('shows why the line moved a task that no run took up', () => {
    runs.mockReturnValue([run(null, false)]);
    moves.mockReturnValue([
      partial<NoteResponseDto>({
        position: 4,
        body: 'Moved to Backlog: the pull request was closed without being merged.',
        at: new Date().toISOString(),
      }),
    ]);
    shown();

    const rows = screen.getAllByRole('listitem');

    expect(rows[0]).toHaveTextContent(
      'Moved to Backlog: the pull request was closed without being merged.',
    );
    expect(rows).toHaveLength(2);
  });

  it('shows a move on a task that has no runs', () => {
    runs.mockReturnValue([]);
    moves.mockReturnValue([
      partial<NoteResponseDto>({
        position: 1,
        body: 'Moved to Implementation. The person who moved it gave this reason:\n\nRebase it.',
        at: new Date().toISOString(),
      }),
    ]);
    shown();

    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Moved to Implementation. The person who moved it gave this reason:',
      ),
    ).toBeInTheDocument();
  });
});
