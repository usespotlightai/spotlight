import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChangeStacks } from '@/lib/change-stack';
import { TaskChangeStack } from '@/routes/TaskChangeStack';
import { INVITATIONS } from '@/test/fixtures/change-stack';

const stacks = vi.fn<(...args: unknown[]) => unknown>();
const stacksFailing = vi.fn<() => boolean>();

vi.mock('@/hooks/api/useTaskChangeStacks', () => ({
  useTaskChangeStacks: () => ({
    data: stacks(),
    isPending: stacks() === undefined,
    errorUpdateCount: stacksFailing() ? 1 : 0,
    error: stacksFailing() ? { statusCode: 404 } : undefined,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useTaskReview', () => ({
  reviewKeys: { forTask: () => ['review'] },
  useTaskReview: () => ({ data: undefined }),
}));

vi.mock('@/hooks/api/useTasks', () => ({
  useTask: () => ({
    data: { id: 'task_1', title: 'Invite people to a team', stationId: null },
    isPending: false,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({ data: [], isPending: false, errorUpdateCount: 0 }),
}));

vi.mock('@/hooks/api/useTaskDecisions', () => ({
  taskDecisionKeys: { forTask: () => ['decisions'] },
  useTaskDecisions: () => ({ data: undefined }),
}));

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: undefined }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

vi.mock('@/routes/PublicChangeStack', () => ({
  PublicChangeStack: () => <p>The public view</p>,
}));

vi.mock('@/components/shared/PatchCodeDiff', () => ({
  PatchCodeDiff: ({ patch }: { patch: string }) => <pre>{patch}</pre>,
}));

const renderAt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter
        initialEntries={['/w/acme/team/team_1/tasks/task_1/changes']}
      >
        <Routes>
          <Route
            path="/w/:slug/team/:teamId/tasks/:taskId/changes"
            element={<TaskChangeStack />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const serving = (value: ChangeStacks) => stacks.mockReturnValue(value);

beforeEach(() => {
  stacks.mockReset();
  stacksFailing.mockReturnValue(false);
});

describe('TaskChangeStack', () => {
  it('links the trail back to the task', () => {
    serving({ stacks: [INVITATIONS] });
    renderAt();

    expect(
      screen.getByRole('link', { name: 'Invite people to a team' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/tasks/task_1');
  });

  it('says who pushed the changes a stack shows', () => {
    serving({
      stacks: [
        {
          ...INVITATIONS,
          runId: null,
          push: {
            head: '9f2c4e1a7b3d5f60812c4d9e7a1b3c5d7e9f1a2b',
            pushedBy: 'maya-chen',
          },
        },
      ],
    });
    renderAt();

    expect(screen.getByText('Pushed by maya-chen')).toHaveAttribute(
      'title',
      'Commit 9f2c4e1',
    );
  });

  it('shows the public view when the team-scoped read finds nothing, since the stack may be public', () => {
    serving(undefined as never);
    stacksFailing.mockReturnValue(true);
    renderAt();

    expect(screen.getByText('The public view')).toBeInTheDocument();
  });

  it('sends a person back to the task when there is no stack', () => {
    serving({ stacks: [] });
    renderAt();

    expect(
      screen.getByRole('link', { name: 'Back to the task' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/tasks/task_1');
  });
});
