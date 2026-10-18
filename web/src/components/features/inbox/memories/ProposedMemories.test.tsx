import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProposedMemories } from '@/components/features/inbox/memories/ProposedMemories';
import type { ProposedMemory } from '@/lib/memory';

const refetch = vi.fn();
const reviewState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch,
};
const approve = { mutate: vi.fn(), isPending: false };
const reject = { mutate: vi.fn(), isPending: false };

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: [{ id: 'claude-code', name: 'Claude Code' }] }),
}));
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
  proposedBy: 'drafter',
  state: 'proposed',
  scope: 'team',
  repository: null,
  paths: [],
  supersedes: null,
  decision: null,
  harness: null,
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
  return render(<ProposedMemories {...ABOUT} />);
};

beforeEach(() => {
  approve.mutate.mockReset();
  reject.mutate.mockReset();
  reviewState.isPending = false;
  reviewState.errorUpdateCount = 0;
});

describe('ProposedMemories', () => {
  it('lists every memory the run proposed', () => {
    showing([
      memory({ id: 'one', body: 'One.' }),
      memory({ id: 'two', body: 'Two.' }),
      memory({ id: 'three', body: 'Three.' }),
    ]);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('asks for each memory to be decided on its own, never several at once', () => {
    showing([
      memory({ id: 'one', body: 'One.' }),
      memory({ id: 'two', body: 'Two.' }),
    ]);

    expect(screen.getAllByRole('button', { name: /^Approve/ })).toHaveLength(2);
  });

  it('names the author of each note it came from, and the harness behind its steps', () => {
    showing([
      memory({
        id: 'one',
        harness: 'claude-code',
        notes: [
          {
            position: 1,
            by: 'person',
            author: { id: 'user_2', name: 'Maya Chen', image: null },
            text: 'Drain webhooks first.',
          },
        ],
        steps: [{ index: 4, kind: 'remember', text: 'Keep the drain order.' }],
      }),
    ]);

    expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });

  it('shows the source of a memory from outside, and no warning', () => {
    showing([
      memory({
        id: 'outside',
        body: 'Outside.',
        source: 'outside',
        notes: [
          {
            position: 3,
            by: 'world',
            author: null,
            text: 'Restart it after deploys.',
          },
        ],
      }),
    ]);

    expect(screen.queryByText(/outside the team/)).not.toBeInTheDocument();
    expect(screen.getByText('Restart it after deploys.')).toBeInTheDocument();
  });

  it('approves an edited memory with its new body', async () => {
    showing([memory({ id: 'one', body: 'One.' })]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit memory 1' }),
    );
    const editor = screen.getByRole('textbox', {
      name: 'The memory as it should be',
    });
    await userEvent.clear(editor);
    await userEvent.type(editor, 'One, edited.');
    await userEvent.click(
      screen.getByRole('button', { name: 'Approve memory 1 as edited' }),
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
    rerender(<ProposedMemories {...ABOUT} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Memory approved by Maya Chen' }),
    ).toBeVisible();
  });

  it('cancels an edit without approving, putting the memory back as it was', async () => {
    showing([memory({ id: 'one', body: 'One.' })]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit memory 1' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'The memory as it should be' }),
      ' More.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(approve.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('One.')).toBeVisible();
  });

  it('approves nothing while the edited memory is empty', async () => {
    showing([memory({ id: 'one', body: 'One.' })]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit memory 1' }),
    );
    await userEvent.clear(
      screen.getByRole('textbox', { name: 'The memory as it should be' }),
    );

    expect(
      screen.getByRole('button', { name: 'Approve memory 1 as edited' }),
    ).toBeDisabled();
  });

  it('explains what kind of memory it is on hover', async () => {
    showing([memory({ id: 'one', kind: 'correction' })]);

    await userEvent.hover(screen.getByText('Correction'));

    expect(
      await screen.findByText(
        'A person correcting the agent, and what is right instead.',
      ),
    ).toBeInTheDocument();
  });

  it('lays out what it is, what kind, where it applies and the files it is about', () => {
    showing([
      memory({
        id: 'one',
        body: 'Retry 410s never.',
        kind: 'rationale',
        scope: 'station',
        repository: 'acme/worker',
        paths: ['src/retries/deliver.ts'],
      }),
    ]);

    const [card] = screen.getAllByRole('listitem');
    const within_ = within(card as HTMLElement);
    expect(within_.getByText('Retry 410s never.')).toBeVisible();
    expect(within_.getByText('Rationale')).toBeVisible();
    expect(within_.getByText('This station')).toBeVisible();
    expect(
      within_.getByText('src/retries/deliver.ts in acme/worker'),
    ).toBeVisible();
  });

  it('leaves out files where a memory is about none', () => {
    showing([memory({ id: 'one' })]);

    expect(screen.queryByText('Files')).not.toBeInTheDocument();
  });

  it('rejects a memory', async () => {
    showing([memory({ id: 'one', body: 'One.' })]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Reject memory 1' }),
    );

    expect(reject.mutate).toHaveBeenCalledWith({ ...ABOUT, memoryId: 'one' });
  });

  it('says who decided a memory, and keeps its buttons there but disabled', () => {
    showing([
      memory({
        id: 'one',
        state: 'approved',
        decision: { by: 'user_2', name: 'Maya Chen', at: '2026-09-27' },
      }),
    ]);

    const [card] = screen.getAllByRole('listitem');
    expect(
      within(card as HTMLElement).getByRole('heading', {
        name: 'Memory approved by Maya Chen',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Approve memory 1' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Reject memory 1' }),
    ).toBeDisabled();
  });

  it('shows nothing in the thread when the run proposed nothing', () => {
    const { container } = showing([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps its place while the memories load', () => {
    reviewState.data = undefined;
    reviewState.isPending = true;
    render(<ProposedMemories {...ABOUT} />);

    expect(
      screen.getByRole('status', {
        name: 'Loading the memories this run proposed',
      }),
    ).toBeInTheDocument();
  });

  it('opens on the memories, and folds them into one line that says what waits', async () => {
    reviewState.data = {
      taskId: 'task_1',
      runId: 'run_1',
      memories: [
        memory({ id: 'one', harness: 'claude-code' }),
        memory({ id: 'two', state: 'approved' }),
      ],
    };
    render(<ProposedMemories {...ABOUT} />);

    const line = screen.getByRole('button', {
      name: 'Claude Code proposed 2 memories · 1 to review',
    });
    expect(line).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(line);

    expect(line).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers to try again when the memories could not be loaded', async () => {
    reviewState.data = undefined;
    reviewState.errorUpdateCount = 1;
    render(<ProposedMemories {...ABOUT} />);

    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));

    expect(refetch).toHaveBeenCalled();
  });
});
