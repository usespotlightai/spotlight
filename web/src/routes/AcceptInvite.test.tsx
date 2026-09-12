import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptInvite } from '@/routes/AcceptInvite';

const invite = vi.fn();
const session = vi.fn();
const accept = vi.fn();
const signIn = vi.fn();
const navigate = vi.fn();

vi.mock('@/hooks/api/useInvite', () => ({
  useInvite: () => invite(),
}));

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => session(),
}));

vi.mock('@/hooks/api/useAcceptInvite', () => ({
  useAcceptInvite: () => ({
    mutate: accept,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/hooks/api/useSignIn', () => ({
  useSignIn: (callbackURL: string) => ({
    mutate: () => signIn(callbackURL),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/invites/tok-123']}>
      <Routes>
        <Route path="/invites/:token" element={<AcceptInvite />} />
      </Routes>
    </MemoryRouter>,
  );

const offered = (over: Record<string, unknown> = {}) => ({
  data: {
    email: 'ada@example.com',
    teamName: 'Platform',
    workspaceName: 'Acme',
    invitedBy: 'Leon Liang',
    standing: 'open',
    ...over,
  },
  isPending: false,
  isError: false,
});

beforeEach(() => {
  invite.mockReturnValue(offered());
  session.mockReturnValue({ data: null, isPending: false });
  accept.mockReset();
  signIn.mockReset();
  navigate.mockReset();
});

describe('AcceptInvite', () => {
  it('says who asked and what they were asked onto', () => {
    showing();

    expect(
      screen.getByRole('heading', {
        name: 'Leon Liang invited you to Platform',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('in the Acme workspace on Spotlight.'),
    ).toBeInTheDocument();
  });

  it('asks somebody signed out to sign in as the person invited', async () => {
    showing();

    expect(
      screen.getByText('Sign in as ada@example.com to accept.'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Continue with GitHub' }),
    );

    expect(signIn).toHaveBeenCalledWith('/invites/tok-123');
  });

  it('takes the invitation up and goes to the team', async () => {
    session.mockReturnValue({
      data: { user: { email: 'ada@example.com' } },
      isPending: false,
    });
    accept.mockImplementation((_, { onSuccess }) =>
      onSuccess({
        workspaceSlug: 'acme',
        teamId: 'team_1',
        teamName: 'Platform',
      }),
    );
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Accept invitation' }),
    );

    expect(navigate).toHaveBeenCalledWith('/w/acme/team/team_1', {
      replace: true,
    });
  });

  it('refuses somebody signed in as anybody else', () => {
    session.mockReturnValue({
      data: { user: { email: 'grace@example.com' } },
      isPending: false,
    });
    showing();

    expect(
      screen.queryByRole('button', { name: 'Accept invitation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/sent to ada@example.com, and you are signed in as/),
    ).toBeInTheDocument();
  });

  it.each([
    ['accepted', 'This invitation has already been accepted.'],
    ['revoked', 'This invitation has been taken back.'],
    ['expired', 'This invitation has run out. Ask for another.'],
  ])('says an invitation that is %s is no longer open', (standing, said) => {
    invite.mockReturnValue(offered({ standing }));
    session.mockReturnValue({
      data: { user: { email: 'ada@example.com' } },
      isPending: false,
    });
    showing();

    expect(screen.getByText(said)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Accept invitation' }),
    ).not.toBeInTheDocument();
  });

  it('says so when the link stands for no invitation', () => {
    invite.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    showing();

    expect(
      screen.getByRole('heading', {
        name: 'This invitation link does not work',
      }),
    ).toBeInTheDocument();
  });

  it('shows nothing until the invitation has been read', () => {
    invite.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });
});
