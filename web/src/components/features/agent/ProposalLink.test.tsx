import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProposalLink } from '@/components/features/agent/ProposalLink';
import type { Proposal } from '@/lib/chat';

const OPEN: Proposal = {
  lineId: 'line_1',
  lineName: 'Default',
  stationId: 'station_1',
  stationName: 'Backlog',
  stationColor: '#a3a8b0',
  title: 'Back off exponentially',
  description: 'Double the wait each time.',
  state: 'open',
  taskId: null,
};

describe('ProposalLink', () => {
  it('names the proposal and opens it when pressed', async () => {
    const onOpen = vi.fn();
    render(<ProposalLink proposal={OPEN} active={false} onOpen={onOpen} />);

    await userEvent.click(
      screen.getByRole('button', { name: /Back off exponentially/ }),
    );

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('Double the wait each time.'),
    ).not.toBeInTheDocument();
  });

  it('says what became of the proposal', () => {
    render(
      <ProposalLink
        proposal={{ ...OPEN, state: 'created', taskId: 'task_1' }}
        active
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent(
      'Proposed task: Back off exponentially',
    );
    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent(
      'Task created',
    );
  });
});
