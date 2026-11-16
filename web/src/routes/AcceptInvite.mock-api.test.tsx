import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { acceptInvite } from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';
import { findToast } from '@/test/toasts';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const TOKEN = 'invite_sam';

describe('AcceptInvite on the mock API', () => {
  serveMockApi();
  quietBrowser();

  it('shows why the invitation could not be accepted in a toast, and keeps Accept invitation', async () => {
    render(<MockApplication at={`/invites/${TOKEN}`} />);
    const accept = await screen.findByRole(
      'button',
      {
        name: 'Accept invitation',
      },
      WAIT,
    );
    await acceptInvite({ path: { token: TOKEN }, throwOnError: true });

    await userEvent.click(accept);

    expect(
      await findToast('This invite has already been accepted.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Accept invitation' }),
    ).toBeEnabled();
  });
});
