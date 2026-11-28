import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProposedMemories } from '@/components/features/inbox/memories/ProposedMemories';
import type { ProposedMemory } from '@/lib/memory';
import { SettledPartContext } from '@/lib/settled-part';

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
const restore = { mutate: vi.fn(), isPending: false };

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
vi.mock('@/hooks/api/useRestoreMemory', () => ({
  useRestoreMemory: () => restore,
}));

const memory = (over: Partial<ProposedMemory>): ProposedMemory => ({
  id: 'memory_1',
  kind: 'preference',
  body: 'Name branches after the ticket.',
  source: 'person',
  state: 'proposed',
  scope: 'team',
  repository: null,
  paths: [],
  supersedes: null,
  retires: null,
  editable: true,
  inactiveMemories: [],
  similarTo: null,
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
  restore.mutate.mockReset();
  reviewState.isPending = false;
  reviewState.errorUpdateCount = 0;
});

describe('ProposedMemories', () => {
  it('shows which memory a retirement ends and why, and offers no edit', () => {
    showing([
      memory({
        editable: false,
        retires: {
          memoryId: 'memory_9',
          handle: 'M-9',
          reason: 'The code no longer does this.',
        },
      }),
    ]);

    expect(screen.getByText('M-9')).toBeTruthy();
    expect(screen.getByText('The code no longer does this.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit memory 1' })).toBeNull();
  });

  it('offers no approval for a retirement whose memory is no longer active', () => {
    showing([
      memory({
        editable: false,
        inactiveMemories: ['M-9'],
        retires: {
          memoryId: 'memory_9',
          handle: 'M-9',
          reason: 'The code no longer does this.',
        },
      }),
    ]);

    expect(
      screen.getByText(
        'M-9 is no longer active, so this retirement no longer applies.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Approve memory 1' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('button', { name: 'Reject memory 1' }),
    ).toHaveProperty('disabled', false);
  });

  it('says a memory was not decided once its inbox item was resolved, and still takes a decision', () => {
    reviewState.data = {
      taskId: 'task_1',
      runId: 'run_1',
      memories: [memory({ id: 'one', body: 'One.' })],
    };
    render(
      <SettledPartContext value>
        <ProposedMemories {...ABOUT} />
      </SettledPartContext>,
    );

    expect(screen.getByText('Not decided')).toBeInTheDocument();
    expect(
      screen.queryByText('Waiting for your approval'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Approve memory / }),
    ).toBeInTheDocument();
  });

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
    const within_ = within(card);
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

  it('restores a rejected memory', async () => {
    showing([
      memory({
        id: 'one',
        state: 'rejected',
        decision: { by: 'user_2', name: 'Maya Chen', at: '2026-09-27' },
      }),
    ]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Restore memory 1' }),
    );

    expect(restore.mutate).toHaveBeenCalledWith({ ...ABOUT, memoryId: 'one' });
  });

  it('folds a rejected memory into one line that can be shown again', async () => {
    showing([
      memory({
        id: 'one',
        body: 'Size disks at 200 GB.',
        state: 'rejected',
        decision: { by: 'user_2', name: 'Maya Chen', at: '2026-09-27' },
      }),
    ]);

    const show = screen.getByRole('button', { name: 'Show memory 1' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Kind').closest('[inert]')).not.toBeNull();

    await userEvent.click(show);

    expect(
      screen.getByRole('button', { name: 'Hide memory 1' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('offers to restore only a rejected memory', () => {
    showing([
      memory({ id: 'one' }),
      memory({
        id: 'two',
        state: 'approved',
        decision: { by: 'user_2', name: 'Maya Chen', at: '2026-09-27' },
      }),
    ]);

    expect(
      screen.queryByRole('button', { name: /^Restore memory/ }),
    ).not.toBeInTheDocument();
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
      within(card).getByRole('heading', {
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

  it('opens on the memories, and collapses them into one line that says what waits', async () => {
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
