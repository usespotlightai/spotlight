import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { MemorySource } from '@/components/features/memory/MemorySource';

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

const showing = () =>
  render(
    <MemoryRouter>
      <MemorySource slug="acme" teamId="team_1" memoryId="memory_1" />
    </MemoryRouter>,
  );

describe('MemorySource', () => {
  it('quotes what it rests on and links to the run and the task', () => {
    memoryState.data = detail({ harness: 'claude-code' });
    showing();

    expect(screen.getByText('A queue needs a worker.')).toBeVisible();
    expect(screen.getByText('Claude Code')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open its run' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/runs/run_1',
    );
    expect(screen.getByRole('link', { name: 'Open its task' })).toBeVisible();
  });

  it('keeps its place while it loads', () => {
    memoryState.data = undefined;
    memoryState.isPending = true;
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading its source' }),
    ).toBeInTheDocument();
  });

  it('leaves a failed load for the details to report', () => {
    memoryState.data = undefined;
    memoryState.isPending = false;
    memoryState.errorUpdateCount = 1;
    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });
});
