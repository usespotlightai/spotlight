import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { acceptInvite } from '@/lib/api';
import { membersPath } from '@/lib/members';
import { api, noContent } from '@/mocks/http';
import { setScenario } from '@/mocks/scenario';
import { serveMockApi } from '@/mocks/testing';
import { SLUG } from '@/mocks/world';
import { membersWorld } from '@/mocks/world/members';
import { SIGNED_IN } from '@/mocks/world/settings';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const JORDAN = 'jordan.lee@acme.dev';

const listed = (name: string) => screen.getByRole('list', { name });

const rowOf = (list: string, text: string) =>
  within(listed(list)).getByText(text).closest('li') as HTMLElement;

const opened = async () => {
  render(<MockApplication at={membersPath(SLUG)} />);
  await within(
    await screen.findByRole('list', { name: 'Members' }, WAIT),
  ).findByText('Maya Chen', undefined, WAIT);
  await within(
    await screen.findByRole('list', { name: 'Pending invites' }, WAIT),
  ).findByText(JORDAN, undefined, WAIT);
};

const actOnInvite = async (action: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: `Actions for ${JORDAN}` }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: action }, WAIT),
  );
};

const openInvite = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Invite people' }));
  return screen.findByRole('dialog', undefined, WAIT);
};

const typed = async (dialog: HTMLElement, text: string) => {
  await userEvent.click(
    within(dialog).getByRole('textbox', { name: 'Email addresses' }),
  );
  await userEvent.paste(text);
};

describe('WorkspaceMembers on the mock API', () => {
  const server = serveMockApi();
  quietBrowser();

  it('says why a role could not be changed, in the server’s words', async () => {
    await opened();
    const me = membersWorld().people.find((each) => each.id === SIGNED_IN.id);
    if (me) {
      me.role = 'admin';
    }

    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Priya Nair' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Change role' }, WAIT),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Member' }, WAIT),
    );

    expect(
      await within(rowOf('Members', 'Priya Nair')).findByRole(
        'alert',
        undefined,
        WAIT,
      ),
    ).toHaveTextContent('You can only set roles for people below you.');
    expect(
      within(rowOf('Members', 'Priya Nair')).getByText('Admin'),
    ).toBeInTheDocument();
  });

  it('says an invite was resent', async () => {
    await opened();

    await actOnInvite('Resend invite');

    expect(
      await within(rowOf('Pending invites', JORDAN)).findByRole(
        'status',
        undefined,
        WAIT,
      ),
    ).toHaveTextContent('Resent');
  });

  it('says why an invite accepted meanwhile could not be resent, and drops it from the list', async () => {
    await opened();
    await acceptInvite({
      path: { token: 'invite_platform' },
      throwOnError: true,
    });

    await actOnInvite('Resend invite');

    expect(
      await screen.findByText(
        'This invite has already been accepted.',
        undefined,
        WAIT,
      ),
    ).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          within(listed('Pending invites')).queryByText(JORDAN),
        ).not.toBeInTheDocument(),
      WAIT,
    );
  });

  it('says why an invite accepted meanwhile could not be revoked', async () => {
    await opened();
    await acceptInvite({
      path: { token: 'invite_platform' },
      throwOnError: true,
    });

    await actOnInvite('Revoke invite');

    expect(
      await screen.findByText(
        'This invite has already been accepted.',
        undefined,
        WAIT,
      ),
    ).toBeInTheDocument();
  });

  it('drops a revoked invite from the list', async () => {
    await opened();

    await actOnInvite('Revoke invite');

    await waitFor(
      () =>
        expect(
          within(listed('Pending invites')).queryByText(JORDAN),
        ).not.toBeInTheDocument(),
      WAIT,
    );
    expect(
      screen.getByRole('heading', { name: /Pending invites\s*3/ }),
    ).toBeInTheDocument();
  });

  it('says so once inviting is no longer allowed', async () => {
    await opened();
    const dialog = await openInvite();
    setScenario({ account: 'member' });

    await typed(dialog, 'ada@acme.dev');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Send invites' }),
    );

    expect(
      await within(dialog).findByRole('alert', undefined, WAIT),
    ).toHaveTextContent(
      'Sorry, you can no longer invite people to this workspace.',
    );
  });

  it('starts afresh when opened again', async () => {
    await opened();
    let dialog = await openInvite();

    await typed(dialog, 'ada@acme.dev');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Send invites' }),
    );
    const done = await within(dialog).findByRole(
      'button',
      { name: 'Done' },
      WAIT,
    );

    expect(done).toHaveFocus();
    expect(
      within(dialog).getByRole('heading', { name: '1 invited' }),
    ).toBeInTheDocument();

    await userEvent.click(done);
    await waitFor(
      () => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      WAIT,
    );

    expect(
      within(listed('Pending invites')).getByText('ada@acme.dev'),
    ).toBeInTheDocument();

    dialog = await openInvite();

    expect(
      within(dialog).getByRole('heading', { name: 'Invite people' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('textbox', { name: 'Email addresses' }),
    ).toHaveValue('');
  });

  it('cannot be closed while the invites are sent', async () => {
    server.use(
      api.post('/workspaces/:slug/invites', async () => {
        await delay('infinite');
        return noContent();
      }),
    );
    await opened();
    const dialog = await openInvite();

    await typed(dialog, 'ada@acme.dev');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Send invites' }),
    );
    await within(dialog).findByRole('button', { name: 'Sending…' }, WAIT);

    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    expect(
      within(dialog).queryByRole('button', { name: 'Close' }),
    ).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends at most 50 addresses at once', async () => {
    await opened();
    const dialog = await openInvite();

    await typed(
      dialog,
      Array.from({ length: 51 }, (_, at) => `person${at}@acme.dev`).join(', '),
    );

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Sorry, the list has 51 addresses. Please invite at most 50 at once.',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Send invites' }),
    ).toBeDisabled();
  });
});
