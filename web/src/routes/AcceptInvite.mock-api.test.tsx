import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { acceptInvite } from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const TOKEN = 'invite_sam';

describe('AcceptInvite on the mock API', () => {
  serveMockApi();
  quietBrowser();

  it('says why the invitation could not be accepted, in the server’s words', async () => {
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

    expect(await screen.findByRole('alert', undefined, WAIT)).toHaveTextContent(
      'This invite has already been accepted.',
    );
    expect(
      screen.getByRole('button', { name: 'Accept invitation' }),
    ).toBeEnabled();
  });
});
