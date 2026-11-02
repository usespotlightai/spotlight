import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { emailsPath, verifyEmailPath } from '@/lib/emails';
import { serveMockApi } from '@/mocks/testing';
import { SLUG } from '@/mocks/world';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const additional = async () =>
  within(await screen.findByRole('list', { name: 'Additional emails' }, WAIT));

describe('AccountEmails on the mock API', () => {
  serveMockApi();
  quietBrowser();

  it('shows the sign-in email and each additional email with its status', async () => {
    render(<MockApplication at={emailsPath(SLUG)} />);

    expect(await screen.findByText('sam@example.com', undefined, WAIT));
    const list = await additional();
    expect(list.getByText('sam.rivera@acme-corp.example')).toBeVisible();
    expect(list.getByText('Verified')).toBeVisible();
    expect(
      list.getByText('Verification link expired. Please resend it.'),
    ).toBeVisible();
  });

  it('adds an email that waits for verification', async () => {
    render(<MockApplication at={emailsPath(SLUG)} />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add email' }, WAIT),
    );
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Email' }),
      'Sam@Slack.example{Enter}',
    );

    const list = await additional();
    expect(
      await list.findByText('sam@slack.example', undefined, WAIT),
    ).toBeVisible();
    expect(
      list.getByText('Verification link sent. It works for 24 hours.'),
    ).toBeVisible();
  });

  it('says why the sign-in email cannot be added, in the server’s words', async () => {
    render(<MockApplication at={emailsPath(SLUG)} />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add email' }, WAIT),
    );
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Email' }),
      'sam@example.com{Enter}',
    );

    expect(await screen.findByRole('alert', undefined, WAIT)).toHaveTextContent(
      'sam@example.com is your sign-in email. It is not an additional email.',
    );
  });

  it('removes an email', async () => {
    render(<MockApplication at={emailsPath(SLUG)} />);

    await userEvent.click(
      await screen.findByRole(
        'button',
        { name: 'Actions for sam@contractor.example' },
        WAIT,
      ),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remove email' }),
    );

    const list = await additional();
    await vi.waitFor(() =>
      expect(list.queryByText('sam@contractor.example')).toBeNull(),
    );
  });

  it('verifies an email from its link', async () => {
    render(<MockApplication at={verifyEmailPath('verification_sam')} />);

    expect(
      await screen.findByRole('heading', { name: 'Email verified' }, WAIT),
    ).toBeVisible();
    expect(
      screen.getByText('Spotlight now knows you by sam@contractor.example.'),
    ).toBeVisible();
  });
});
