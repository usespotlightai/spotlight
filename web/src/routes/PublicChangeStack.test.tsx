import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LayerQuestions } from '@/components/features/changes/LayerQuestions';
import {
  usePublicRunChangeStacks,
  usePublicTaskChangeStacks,
} from '@/hooks/api/usePublicChangeStacks';
import { type SessionUser, useSession } from '@/hooks/api/useSession';
import type { ChangeStack } from '@/lib/change-stack';
import { PublicChangeStack } from '@/routes/PublicChangeStack';
import { INVITATIONS } from '@/test/fixtures/change-stack';
import { partial } from '@/test/partial';

vi.mock('@/hooks/api/useSession', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/api/usePublicChangeStacks', () => ({
  usePublicTaskChangeStacks: vi.fn(),
  usePublicRunChangeStacks: vi.fn(),
}));
vi.mock('@/hooks/api/useAnswerStackQuestion', () => ({
  useAnswerStackQuestion: () => ({ isPending: false, isError: false }),
}));
vi.mock('@/hooks/useMe', () => ({ useMe: () => null }));
vi.mock('@/hooks/useInferenceUnset', () => ({
  useInferenceUnset: () => false,
}));
vi.mock('@/components/features/changes/ChangeStackView', () => ({
  ChangeStackView: ({ stack }: { stack: ChangeStack }) => {
    const layer = stack.cohorts.at(0)?.layers.at(0);

    return (
      <div>
        <p>{`files: ${stack.files.length}`}</p>
        <p>{`layer: ${layer?.title}`}</p>
        {layer && (
          <LayerQuestions stack={stack} layer={layer} onReveal={() => {}} />
        )}
      </div>
    );
  },
}));

const mockSession = vi.mocked(useSession);
const mockTask = vi.mocked(usePublicTaskChangeStacks);
const mockRun = vi.mocked(usePublicRunChangeStacks);

const QUESTIONED: ChangeStack = {
  ...INVITATIONS,
  cohorts: INVITATIONS.cohorts.map((cohort, at) => ({
    ...cohort,
    layers: cohort.layers.map((layer, place) =>
      at === 0 && place === 0
        ? {
            ...layer,
            questions: [
              {
                id: 'c1.l1.q1',
                question: 'What does the unique token prevent?',
                hunks: ['h1'],
                answered: null,
              },
            ],
          }
        : layer,
    ),
  })),
};

type StacksQuery = ReturnType<typeof usePublicTaskChangeStacks>;

const loaded = (data: { stacks: ChangeStack[] } | null): StacksQuery =>
  partial<StacksQuery>({
    data,
    isPending: false,
    errorUpdateCount: 0,
    isFetching: false,
    refetch: vi.fn(),
  });

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/tasks/:taskId/changes"
          element={<PublicChangeStack />}
        />
        <Route
          path="/w/:slug/team/:teamId/runs/:runId/changes"
          element={<PublicChangeStack />}
        />
        <Route path="/login" element={<p>login screen</p>} />
      </Routes>
    </MemoryRouter>,
  );

const TASK_URL = '/w/acme/team/team_1/tasks/task_1/changes';

beforeEach(() => {
  mockSession.mockReset();
  mockTask.mockReset();
  mockRun.mockReset();
  mockSession.mockReturnValue(
    partial<ReturnType<typeof useSession>>({ data: null, isPending: false }),
  );
  mockTask.mockReturnValue(loaded({ stacks: [QUESTIONED] }));
  mockRun.mockReturnValue(loaded({ stacks: [QUESTIONED] }));
});

describe('PublicChangeStack', () => {
  it('shows the stack to an anonymous visitor', () => {
    renderAt(TASK_URL);

    expect(
      screen.getByText(`files: ${QUESTIONED.files.length}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText('layer: Add the invitation data model'),
    ).toBeInTheDocument();
    expect(mockTask).toHaveBeenCalledWith('task_1');
  });

  it('reads the run of a run address', () => {
    renderAt('/w/acme/team/team_1/runs/run_1/changes');

    expect(mockRun).toHaveBeenCalledWith('run_1');
    expect(screen.getByText(/^files:/)).toBeInTheDocument();
  });

  it('shows a question to read, with a prompt to log in or create an account instead of the answer form', () => {
    renderAt(TASK_URL);

    expect(
      screen.getByText('What does the unique token prevent?'),
    ).toBeInTheDocument();
    const question = within(screen.getByRole('region', { name: /^Question:/ }));

    expect(question.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      question.getByRole('link', { name: 'create an account' }),
    ).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
  });

  it('offers a way to log in in the bar', () => {
    renderAt(TASK_URL);

    expect(screen.getAllByRole('link', { name: 'Log in' })).toHaveLength(2);
  });

  it('shows no review controls', () => {
    renderAt(TASK_URL);

    expect(screen.queryByRole('button', { name: /submit review/i })).toBeNull();
  });

  it('tells a signed-in person who is not a member that only members take part, with no way to log in', () => {
    mockSession.mockReturnValue(
      partial<ReturnType<typeof useSession>>({
        data: { user: partial<SessionUser>({ id: 'user_1' }) },
        isPending: false,
      }),
    );

    renderAt(TASK_URL);

    expect(
      screen.getByText('Only team members can answer this question.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('says the stack is not public, or does not exist, on a 404', () => {
    mockTask.mockReturnValue(loaded(null));

    renderAt(TASK_URL);

    expect(
      screen.getByText(
        'This change stack is not public, or it does not exist.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers a retry when loading fails', () => {
    mockTask.mockReturnValue(
      partial<StacksQuery>({
        data: undefined,
        isPending: true,
        errorUpdateCount: 1,
        isFetching: false,
        refetch: vi.fn(),
      }),
    );

    renderAt(TASK_URL);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The change stack could not be loaded.',
    );
  });

  it('does not send an anonymous visitor to log in', () => {
    renderAt(TASK_URL);

    expect(screen.queryByText('login screen')).toBeNull();
  });
});
