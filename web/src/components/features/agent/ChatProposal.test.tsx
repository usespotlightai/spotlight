import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatProposal } from '@/components/features/agent/ChatProposal';
import type { Proposal } from '@/lib/chat';
import { toast } from '@/lib/toast';

const created = vi.fn();
const dismissed = vi.fn();

vi.mock('@/hooks/api/useAcceptProposal', () => ({
  useAcceptProposal: () => ({ mutate: created, isPending: false }),
}));
vi.mock('@/hooks/api/useDismissProposal', () => ({
  useDismissProposal: () => ({ mutate: dismissed, isPending: false }),
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

const proposing = (proposal: Proposal) => (
  <MemoryRouter>
    <ChatProposal
      slug="acme"
      teamId="team_1"
      chatId="chat_1"
      position={3}
      proposal={proposal}
    />
  </MemoryRouter>
);

const showing = (proposal: Proposal = OPEN) => render(proposing(proposal));

const accepting = async () => {
  created.mockImplementation((_input, options) => options?.onSuccess?.());
  const shown = showing();

  await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
  shown.rerender(proposing({ ...OPEN, state: 'accepted' }));

  return shown;
};

beforeEach(() => {
  created.mockReset();
  dismissed.mockReset();
  vi.restoreAllMocks();
});

describe('ChatProposal', () => {
  it('says what the task is and where it would start', () => {
    showing();

    expect(screen.getByText('Back off exponentially')).toBeInTheDocument();
    expect(screen.getByText('Default › Backlog')).toBeInTheDocument();
    expect(screen.getByText('Waiting for your approval')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
  });

  it('says the task is being created while it is, offering nothing more to do', () => {
    showing({ ...OPEN, state: 'accepted' });

    expect(screen.getByText('Creating the task')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
  });

  it('says the proposal was dismissed, offering nothing more to do', () => {
    showing({ ...OPEN, state: 'dismissed' });

    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
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
        actionProps: expect.objectContaining({ children: 'Open task' }),
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
});
