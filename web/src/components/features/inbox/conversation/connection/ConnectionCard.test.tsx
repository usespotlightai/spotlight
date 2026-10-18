import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionCard } from '@/components/features/inbox/conversation/connection/ConnectionCard';
import type { InboxConnectionResponseDto } from '@/lib/api';

const connect = vi.fn();

vi.mock('@/hooks/api/useConnectIntegration', () => ({
  useConnectIntegration: () => ({ mutate: connect, isPending: false }),
}));

const ASKED: InboxConnectionResponseDto = {
  integration: 'linear',
  integrationName: 'Linear',
  personId: 'user_maya',
  personName: 'Maya Chen',
  met: false,
};

const showing = (
  connection: InboxConnectionResponseDto,
  viewer: string | null,
) =>
  render(
    <MemoryRouter initialEntries={['/w/acme/inbox/task_comment:0']}>
      <ConnectionCard connection={connection} teamId="team_1" viewer={viewer} />
    </MemoryRouter>,
  );

beforeEach(() => {
  connect.mockClear();
});

describe('ConnectionCard', () => {
  it('lets the person asked connect, returning to this item', async () => {
    showing(ASKED, 'user_maya');

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(connect).toHaveBeenCalledWith({
      integration: 'linear',
      actsAs: 'requester',
      returnTo: '/w/acme/inbox/task_comment:0',
    });
  });

  it('shows anyone else whom it waits on, with nothing to press', () => {
    showing(ASKED, 'user_sam');

    expect(
      screen.getByText('The run is waiting for Maya Chen to connect Linear.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Connect' }),
    ).not.toBeInTheDocument();
  });

  it('says the connection was made once it was', () => {
    showing({ ...ASKED, met: true }, 'user_sam');

    expect(
      screen.getByRole('heading', { name: 'Connected Linear' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Connect' }),
    ).not.toBeInTheDocument();
  });
});
