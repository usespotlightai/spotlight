import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryDetails } from '@/components/features/memory/MemoryDetails';

const memoryState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch: vi.fn(),
};

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: [{ id: 'claude-code', name: 'Claude Code' }] }),
}));
vi.mock('@/hooks/api/useTeamMemory', () => ({
  useTeamMemory: () => memoryState,
}));
vi.mock('@/hooks/api/useEditMemory', () => ({
  useEditMemory: () => ({ mutate: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/hooks/api/useRetireMemory', () => ({
  useRetireMemory: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { name: 'Ada Lovelace', image: null } } }),
}));

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'memory_1',
  handle: 'M-1',
  kind: 'rationale',
  body: 'Retry uploads in the request.',
  source: 'run',
  status: 'active',
  reach: 'team',
  lineId: null,
  stationId: null,
  repository: null,
  paths: [],
  approvedBy: { id: 'user_2', name: 'Maya Chen', image: null },
  approvedAt: '2026-09-27T10:00:00.000Z',
  supersedes: null,
  retirement: null,
  grounds: { taskId: 'task_1', runId: 'run_1' },
  steps: [{ index: 3, kind: 'thought', text: 'A queue needs a worker.' }],
  notes: [],
  superseded: null,
  successor: null,
  ...over,
});

const details = (open: boolean) => (
  <MemoryRouter>
    <MemoryDetails
      teamId="team_1"
      memoryId="memory_1"
      open={open}
      editing={false}
      saving={false}
      unsaveable={false}
      onEdit={vi.fn()}
      onCancel={vi.fn()}
      onSave={vi.fn()}
    />
  </MemoryRouter>
);

const showing = () =>
  render(
    <MemoryRouter>
      <MemoryDetails
        teamId="team_1"
        memoryId="memory_1"
        open
        editing={false}
        saving={false}
        unsaveable={false}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    </MemoryRouter>,
  );

beforeEach(() => {
  memoryState.errorUpdateCount = 0;
});

describe('MemoryDetails', () => {
  it('offers to correct or retire an active memory', () => {
    memoryState.data = detail();
    showing();

    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retire' })).toBeVisible();
  });

  it('asks why in place when retiring, not in a dialog', async () => {
    memoryState.data = detail();
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Retire' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('form', { name: 'Retire this memory' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible(),
    );
  });

  it('drops a half-written retirement when its row folds', async () => {
    memoryState.data = detail();
    const { rerender } = render(details(true));

    await userEvent.click(screen.getByRole('button', { name: 'Retire' }));
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();

    rerender(details(false));
    rerender(details(true));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible(),
    );
  });

  it('offers nothing to do with a retired memory, and names what replaced it', () => {
    memoryState.data = detail({
      status: 'retired',
      retirement: {
        at: '2026-09-27T11:00:00.000Z',
        by: null,
        reason: null,
        supersededBy: 'memory_2',
      },
      successor: { id: 'memory_2', body: 'Retry uploads from the worker.' },
    });
    showing();

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(
      screen.getByText('Replaced by: Retry uploads from the worker.'),
    ).toBeVisible();
  });
});
