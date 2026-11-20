import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatProposal } from '@/components/features/agent/ChatProposal';
import type { Attachment } from '@/lib/attachment';
import type { Proposal } from '@/lib/chat';
import { toast } from '@/lib/toast';

const created =
  vi.fn<(input: unknown, options?: { onError?: () => void }) => void>();
const dismissed = vi.fn();
const restored = vi.fn();

vi.mock('@/hooks/api/useAcceptProposal', () => ({
  useAcceptProposal: () => ({ mutate: created, isPending: false }),
}));
vi.mock('@/hooks/api/useDismissProposal', () => ({
  useDismissProposal: () => ({ mutate: dismissed, isPending: false }),
}));
vi.mock('@/hooks/api/useRestoreProposal', () => ({
  useRestoreProposal: () => ({ mutate: restored, isPending: false }),
}));

const OPEN: Proposal = {
  lineId: 'line_1',
  lineName: 'Default',
  stationId: 'station_1',
  stationName: 'Backlog',
  stationColor: '#a3a8b0',
  stationPosition: 0,
  stationCount: 4,
  title: 'Back off exponentially',
  description: null,
  state: 'open',
  taskId: null,
};

const MOCKUP: Attachment = {
  id: 'att_1',
  name: 'mockup.png',
  contentType: 'image/png',
  size: 2048,
};

const awaiting = { current: new Set<number>() };

const proposing = (
  proposal: Proposal,
  attachments: readonly Attachment[] = [],
) => (
  <MemoryRouter initialEntries={['/w/acme/agent']}>
    <Routes>
      <Route
        path="/w/:slug/agent"
        element={
          <ChatProposal
            slug="acme"
            teamId="team_1"
            chatId="chat_1"
            position={3}
            proposal={proposal}
            attachments={attachments}
            awaiting={awaiting}
          />
        }
      />
    </Routes>
  </MemoryRouter>
);

const showing = (proposal: Proposal = OPEN) => render(proposing(proposal));

const accepting = async () => {
  const shown = showing();

  await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
  shown.rerender(proposing({ ...OPEN, state: 'accepted' }));

  return shown;
};

beforeEach(() => {
  awaiting.current.clear();
  created.mockReset();
  dismissed.mockReset();
  restored.mockReset();
  vi.restoreAllMocks();
});

describe('ChatProposal', () => {
  it('says what the task is and where it would start', () => {
    showing();

    expect(screen.getByText('Back off exponentially')).toBeInTheDocument();
    expect(screen.getByText('Default › Backlog')).toBeInTheDocument();
    expect(screen.getByText('Waiting for your approval')).toBeInTheDocument();
  });

  it('shows the files the task will be given', () => {
    render(proposing(OPEN, [MOCKUP]));

    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View mockup.png' }),
    ).toBeInTheDocument();
  });

  it('shows no files where the proposal has none', () => {
    showing();

    expect(screen.queryByText('Files')).not.toBeInTheDocument();
  });

  it('creates the proposed task on request', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));

    expect(created).toHaveBeenCalledWith(
      { teamId: 'team_1', chatId: 'chat_1', position: 3 },
      expect.anything(),
    );
  });

  it('turns the proposal down on request', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(dismissed).toHaveBeenCalledWith({
      teamId: 'team_1',
      chatId: 'chat_1',
      position: 3,
    });
  });

  it('links to the task once it is created, offering nothing more to do', () => {
    showing({ ...OPEN, state: 'created', taskId: 'task_1' });

    expect(screen.getByText('Task created')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back off exponentially' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/tasks/task_1');
    expect(
      screen.queryByRole('button', { name: 'Create task' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();
  });

  it('says the task is being created while it is, offering nothing more to do', () => {
    showing({ ...OPEN, state: 'accepted' });

    expect(screen.getByText('Creating the task')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create task' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();
  });

  it('says the proposal was dismissed, offering nothing more to do', () => {
    showing({ ...OPEN, state: 'dismissed' });

    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create task' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();
  });

  it('restores a dismissed proposal on request', async () => {
    showing({ ...OPEN, state: 'dismissed' });

    await userEvent.click(
      screen.getByRole('button', { name: 'Restore Back off exponentially' }),
    );

    expect(restored).toHaveBeenCalledWith({
      teamId: 'team_1',
      chatId: 'chat_1',
      position: 3,
    });
  });

  it('says a newer proposal replaced this one, folded like a dismissed one', () => {
    showing({ ...OPEN, state: 'replaced' });

    expect(
      screen.getByText('Replaced by a newer proposal'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show the proposal' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: 'Restore Back off exponentially' }),
    ).toBeEnabled();
  });

  it('moves focus to the restore button once the proposal is dismissed', async () => {
    const shown = showing();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    shown.rerender(proposing({ ...OPEN, state: 'dismissed' }));

    expect(
      screen.getByRole('button', { name: 'Restore Back off exponentially' }),
    ).toHaveFocus();
  });

  it('moves focus to Create task once the proposal is restored', async () => {
    const shown = showing({ ...OPEN, state: 'dismissed' });

    await userEvent.click(
      screen.getByRole('button', { name: 'Restore Back off exponentially' }),
    );
    shown.rerender(proposing(OPEN));

    expect(screen.getByRole('button', { name: 'Create task' })).toHaveFocus();
  });

  it('says only once that the task is being created', () => {
    showing({ ...OPEN, state: 'accepted' });

    expect(screen.getAllByText(/Creating the task/)).toHaveLength(1);
  });

  it('offers no restore while the proposal is open', () => {
    showing();

    expect(
      screen.queryByRole('button', { name: 'Restore Back off exponentially' }),
    ).not.toBeInTheDocument();
  });

  it('cannot create a task at a station that is gone', () => {
    showing({ ...OPEN, lineName: null, stationName: null });

    expect(screen.getByText('Station deleted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled();
  });

  it('confirms the task once it is created, with a way to open it', async () => {
    const add = vi.spyOn(toast, 'add');
    const shown = await accepting();

    expect(add).not.toHaveBeenCalled();

    shown.rerender(proposing({ ...OPEN, state: 'created', taskId: 'task_1' }));

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Task created',
        description: 'Back off exponentially',
        actionProps: expect.objectContaining({
          children: 'Open task',
        }) as unknown,
      }),
    );
  });

  it('says so when the task could not be created', async () => {
    const add = vi.spyOn(toast, 'add');
    const shown = await accepting();

    shown.rerender(proposing(OPEN));

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Sorry, the task was not created',
      }),
    );
  });

  it('stays quiet about tasks someone else created', () => {
    const add = vi.spyOn(toast, 'add');
    const shown = showing({ ...OPEN, state: 'accepted' });

    shown.rerender(proposing({ ...OPEN, state: 'created', taskId: 'task_1' }));

    expect(add).not.toHaveBeenCalled();
  });

  it('confirms the task when the proposal update beats the accept response', async () => {
    const add = vi.spyOn(toast, 'add');
    const shown = showing();

    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    shown.rerender(proposing({ ...OPEN, state: 'created', taskId: 'task_1' }));

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Task created' }),
    );
  });

  it('waits for the task id before it confirms the task', async () => {
    const add = vi.spyOn(toast, 'add');
    const shown = await accepting();

    shown.rerender(proposing({ ...OPEN, state: 'created' }));
    expect(add).not.toHaveBeenCalled();

    shown.rerender(proposing({ ...OPEN, state: 'created', taskId: 'task_1' }));
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Task created' }),
    );
  });

  it('stays quiet when the accept request fails', async () => {
    created.mockImplementation((_input, options) => options?.onError?.());
    const add = vi.spyOn(toast, 'add');
    const shown = showing();

    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    shown.rerender(proposing({ ...OPEN, state: 'created', taskId: 'task_1' }));

    expect(add).not.toHaveBeenCalled();
  });
});
