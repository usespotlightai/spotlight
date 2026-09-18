import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProposalDetail } from '@/components/features/agent/ProposalDetail';
import type { Proposal } from '@/lib/chat';

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
  title: 'Back off exponentially',
  description: null,
  state: 'open',
  taskId: null,
};

const showing = (proposal: Proposal = OPEN, onClose = vi.fn()) => {
  render(
    <ProposalDetail
      teamId="team_1"
      chatId="chat_1"
      position={3}
      proposal={proposal}
      open
      onClose={onClose}
    />,
  );

  return { onClose };
};

beforeEach(() => {
  localStorage.clear();
  created.mockReset();
  dismissed.mockReset();
});

describe('ProposalDetail', () => {
  it('says what the task is and where it would start', () => {
    showing();

    expect(screen.getByText('Back off exponentially')).toBeInTheDocument();
    expect(screen.getByText('Default › Backlog')).toBeInTheDocument();
  });

  it('creates the proposed task when asked', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));

    expect(created).toHaveBeenCalledWith({
      teamId: 'team_1',
      chatId: 'chat_1',
      position: 3,
    });
  });

  it('turns the proposal down when asked', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(dismissed).toHaveBeenCalledWith({
      teamId: 'team_1',
      chatId: 'chat_1',
      position: 3,
    });
  });

  it('says the task was created, offering nothing more to do', () => {
    showing({ ...OPEN, state: 'created', taskId: 'task_1' });

    expect(screen.getByRole('button', { name: 'Task created' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
  });

  it('says the task is being created while it is, offering nothing more to do', () => {
    showing({ ...OPEN, state: 'accepted' });

    expect(
      screen.getByRole('button', { name: 'Creating task…' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
  });

  it('says the proposal was dismissed, offering nothing more to do', () => {
    showing({ ...OPEN, state: 'dismissed' });

    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismissed' })).toBeDisabled();
  });

  it('cannot create a task at a station that is gone', () => {
    showing({ ...OPEN, lineName: null, stationName: null });

    expect(screen.getByText('A station that is gone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled();
  });

  it('closes when asked', async () => {
    const { onClose } = showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Close the proposal' }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
