import { render, screen } from '@testing-library/react';
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

vi.mock('@/hooks/api/useTeamMemory', () => ({
  useTeamMemory: () => memoryState,
}));
vi.mock('@/hooks/api/useEditMemory', () => ({
  useEditMemory: () => ({ mutate: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/hooks/api/useRetireMemory', () => ({
  useRetireMemory: () => ({ mutate: vi.fn(), reset: vi.fn() }),
}));

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'memory_1',
  handle: 'M-1',
  kind: 'rationale',
  body: 'Retry uploads in the request.',
  source: 'run',
  standing: 'stands',
  reach: 'team',
  lineId: null,
  stationId: null,
  repository: null,
  paths: [],
  approvedBy: { id: 'user_2', name: 'Maya Chen' },
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

const showing = () =>
  render(
    <MemoryRouter>
      <MemoryDetails
        slug="acme"
        teamId="team_1"
        memoryId="memory_1"
        lines={[]}
      />
    </MemoryRouter>,
  );

beforeEach(() => {
  memoryState.errorUpdateCount = 0;
});

describe('MemoryDetails', () => {
  it('links to the run and the task a memory rests on', () => {
    memoryState.data = detail();
    showing();

    expect(
      screen.getByRole('link', { name: 'Open the run it came from' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_1');
    expect(screen.getByRole('link', { name: 'Open its task' })).toBeVisible();
  });

  it('offers to correct or retire a standing memory', () => {
    memoryState.data = detail();
    showing();

    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retire' })).toBeVisible();
  });

  it('offers nothing to do with a retired memory, and names what replaced it', () => {
    memoryState.data = detail({
      standing: 'retired',
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
