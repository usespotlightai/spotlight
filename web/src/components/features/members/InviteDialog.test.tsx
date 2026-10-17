import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteDialog } from '@/components/features/members/InviteDialog';

const invite = vi.fn();
const mutationState = vi.fn();

vi.mock('@/hooks/api/useInviteToWorkspace', () => ({
  useInviteToWorkspace: () => ({
    mutate: invite,
    reset: vi.fn(),
    isPending: mutationState() === 'pending',
    isError: mutationState() === 'failed',
    error:
      mutationState() === 'failed'
        ? new Error('Sorry, those teams are not in this workspace.')
        : null,
  }),
}));

const TEAMS = [
  { id: 'team_1', name: 'Platform' },
  { id: 'team_2', name: 'Growth' },
];

const opened = (teamIds?: string[]) => {
  render(
    <InviteDialog
      open
      onOpenChange={vi.fn()}
      slug="acme"
      teams={TEAMS}
      teamIds={teamIds}
    />,
  );

  return screen.getByRole('dialog');
};

const typed = async (dialog: HTMLElement, text: string) => {
  const field = within(dialog).getByRole('textbox', {
    name: 'Email addresses',
  });
  await userEvent.type(field, text);
  return field;
};

const send = (dialog: HTMLElement) =>
  userEvent.click(within(dialog).getByRole('button', { name: 'Send invites' }));

beforeEach(() => {
  invite.mockReset();
  mutationState.mockReturnValue('idle');
});

describe('InviteDialog', () => {
  it('sends every address typed, apart by commas or new lines, as members on no team', async () => {
    const dialog = opened();

    await typed(
      dialog,
      'ada@example.com, grace@example.com{Enter}alan@example.com',
    );
    await send(dialog);

    expect(invite).toHaveBeenCalledWith(
      {
        emails: ['ada@example.com', 'grace@example.com', 'alan@example.com'],
        role: 'member',
        teamIds: [],
      },
      expect.anything(),
    );
  });

  it('sends an address typed twice only once', async () => {
    const dialog = opened();

    await typed(dialog, 'ada@example.com ADA@example.com');
    await send(dialog);

    expect(invite).toHaveBeenCalledWith(
      expect.objectContaining({ emails: ['ada@example.com'] }),
      expect.anything(),
    );
  });

  it('names the addresses that are not email addresses, and sends nothing', async () => {
    const dialog = opened();

    await typed(dialog, 'ada@example.com, grace, alan@');
    await send(dialog);

    expect(
      within(dialog).getByText('Not an email address: grace, alan@'),
    ).toBeInTheDocument();
    expect(invite).not.toHaveBeenCalled();
  });

  it('waits for the field to be left before naming what is wrong', async () => {
    const dialog = opened();

    const field = await typed(dialog, 'ada@');

    expect(
      within(dialog).queryByText(/Not an email address/),
    ).not.toBeInTheDocument();

    field.blur();

    expect(
      await within(dialog).findByText('Not an email address: ada@'),
    ).toBeInTheDocument();
  });

  it('sends nothing while no address is typed', () => {
    const dialog = opened();

    expect(
      within(dialog).getByRole('button', { name: 'Send invites' }),
    ).toBeDisabled();
  });

  it('invites as the role and onto the teams picked', async () => {
    const dialog = opened();

    await typed(dialog, 'ada@example.com');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Invite as: Member' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Admin' }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Teams: No team' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Growth' }),
    );
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Platform' }),
    );
    await userEvent.keyboard('{Escape}');
    await send(dialog);

    expect(invite).toHaveBeenCalledWith(
      {
        emails: ['ada@example.com'],
        role: 'admin',
        teamIds: ['team_1', 'team_2'],
      },
      expect.anything(),
    );
  });

  it('starts with the teams it was opened for', () => {
    const dialog = opened(['team_2']);

    expect(
      within(dialog).getByRole('button', { name: 'Teams: Growth' }),
    ).toBeInTheDocument();
  });

  it('says what happened to each address once sent', async () => {
    invite.mockImplementation((_, { onSuccess }) =>
      onSuccess([
        { email: 'ada@example.com', outcome: 'invited' },
        { email: 'grace@example.com', outcome: 'sent-again' },
        { email: 'sam@example.com', outcome: 'already-a-member' },
        { email: 'alan@example.com', outcome: 'not-sent' },
      ]),
    );
    const dialog = opened();

    await typed(
      dialog,
      'ada@example.com grace@example.com sam@example.com alan@example.com',
    );
    await send(dialog);

    const outcomes = within(dialog).getByRole('list', {
      name: 'What happened to each address',
    });

    expect(
      within(dialog).getByRole('heading', {
        name: '1 invited · 1 sent again · 1 already in the workspace · 1 not sent',
      }),
    ).toBeInTheDocument();
    expect(
      within(outcomes)
        .getAllByRole('listitem')
        .map((each) => each.textContent),
    ).toEqual([
      'ada@example.comInvited',
      'grace@example.comSent again',
      'sam@example.comAlready a member',
      'alan@example.comNot sent. Please resend it from Pending invites.',
    ]);
  });

  it('says why the invites could not be sent', () => {
    mutationState.mockReturnValue('failed');
    const dialog = opened();

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Sorry, those teams are not in this workspace.',
    );
  });

  it('locks the form while the invites are sent', () => {
    mutationState.mockReturnValue('pending');
    const dialog = opened();

    expect(
      within(dialog).getByRole('button', { name: 'Sending…' }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('textbox', { name: 'Email addresses' }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
  });
});
