import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryReview } from '@/components/features/inbox/memories/MemoryReview';
import type { ProposedMemory } from '@/lib/memory';

const refetch = vi.fn();
const reviewState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch,
};
const approve = { mutate: vi.fn(), isPending: false, isError: false };
const reject = { mutate: vi.fn(), isPending: false, isError: false };

vi.mock('@/hooks/api/useMemoryReview', () => ({
  useMemoryReview: () => reviewState,
}));
vi.mock('@/hooks/api/useApproveMemories', () => ({
  useApproveMemories: () => approve,
}));
vi.mock('@/hooks/api/useRejectMemory', () => ({
  useRejectMemory: () => reject,
}));

const memory = (over: Partial<ProposedMemory>): ProposedMemory => ({
  id: 'memory_1',
  kind: 'preference',
  body: 'Name branches after the ticket.',
  source: 'person',
  origin: 'drafted',
  state: 'proposed',
  reach: 'team',
  repository: null,
  paths: [],
  supersedes: null,
  decision: null,
  steps: [],
  notes: [],
  ...over,
});

const ABOUT = {
  slug: 'acme',
  teamId: 'team_1',
  taskId: 'task_1',
  runId: 'run_1',
};

const showing = (memories: ProposedMemory[]) => {
  reviewState.data = { taskId: 'task_1', runId: 'run_1', memories };
  return render(<MemoryReview {...ABOUT} />);
};

beforeEach(() => {
  approve.mutate.mockReset();
  reject.mutate.mockReset();
  reviewState.isPending = false;
  reviewState.errorUpdateCount = 0;
});

describe('MemoryReview', () => {
  it('lists every memory the run proposed', () => {
    showing([
      memory({ id: 'one', body: 'One.' }),
      memory({ id: 'two', body: 'Two.' }),
      memory({ id: 'three', body: 'Three.' }),
    ]);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('approves the memories from the team together, leaving the one from outside out', async () => {
    showing([
      memory({ id: 'one', body: 'One.' }),
      memory({ id: 'two', body: 'Two.' }),
      memory({ id: 'outside', body: 'Outside.', source: 'outside' }),
    ]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Approve all 2 from the team' }),
    );

    expect(approve.mutate).toHaveBeenCalledWith({
      ...ABOUT,
      memories: [{ id: 'one' }, { id: 'two' }],
    });
  });

  it('warns about a memory from outside and shows what it rests on without asking', () => {
    showing([
      memory({
        id: 'outside',
        body: 'Outside.',
        source: 'outside',
        notes: [
          { position: 3, by: 'world', text: 'Restart it after deploys.' },
        ],
      }),
    ]);

    expect(
      screen.getByText(/rests on work from outside the team/),
    ).toBeVisible();
    expect(screen.getByText('Restart it after deploys.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'What it rests on' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.queryByRole('button', { name: /^Approve all/ }),
    ).not.toBeInTheDocument();
  });

  it('approves an edited memory with its new body', async () => {
    showing([memory({ id: 'one', body: 'One.' })]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit memory 1' }),
    );
    const editor = screen.getByRole('textbox', {
      name: 'The memory as it should stand',
    });
    await userEvent.clear(editor);
    await userEvent.type(editor, 'One, edited.');
    await userEvent.click(
      screen.getByRole('button', { name: 'Approve as edited' }),
    );

    expect(approve.mutate).toHaveBeenCalledWith({
      ...ABOUT,
      memories: [{ id: 'one', body: 'One, edited.' }],
    });
  });

  it('closes the editor once the edited memory is approved', async () => {
    const { rerender } = showing([memory({ id: 'one', body: 'One.' })]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit memory 1' }),
    );
    reviewState.data = {
      taskId: 'task_1',
      runId: 'run_1',
      memories: [
        memory({
          id: 'one',
          body: 'One, edited.',
          state: 'approved',
          decision: { by: 'user_2', name: 'Maya Chen', at: '2026-09-27' },
        }),
      ],
    };
    rerender(<MemoryReview {...ABOUT} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Maya Chen approved this.')).toBeVisible();
  });

  it('rejects a memory', async () => {
    showing([memory({ id: 'one', body: 'One.' })]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Reject memory 1' }),
    );

    expect(reject.mutate).toHaveBeenCalledWith({ ...ABOUT, memoryId: 'one' });
  });

  it('says who decided a memory, and offers nothing more to do with it', () => {
    showing([
      memory({
        id: 'one',
        state: 'approved',
        decision: { by: 'user_2', name: 'Maya Chen', at: '2026-09-27' },
      }),
    ]);

    const [card] = screen.getAllByRole('listitem');
    expect(
      within(card as HTMLElement).getByText('Maya Chen approved this.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
  });

  it('says there is nothing left when the run proposed nothing', () => {
    showing([]);

    expect(screen.getByText(/proposed nothing left to keep/)).toBeVisible();
  });

  it('offers to try again when the memories could not be loaded', async () => {
    reviewState.data = undefined;
    reviewState.errorUpdateCount = 1;
    render(<MemoryReview {...ABOUT} />);

    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));

    expect(refetch).toHaveBeenCalled();
  });
});
