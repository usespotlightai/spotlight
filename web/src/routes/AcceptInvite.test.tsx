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
const refetch = vi.fn();

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
  }),
}));

vi.mock('@/hooks/api/useSignIn', () => ({
  useSignIn: (callbackURL: string) => ({
    mutate: () => signIn(callbackURL),
    isPending: false,
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
    workspaceName: 'Acme',
    invitedBy: 'Leon Liang',
    role: 'member',
    teamNames: ['Platform'],
    standing: 'open',
    ...over,
  },
  isPending: false,
  errorUpdateCount: 0,
  isFetching: false,
  refetch,
});

beforeEach(() => {
  invite.mockReturnValue(offered());
  session.mockReturnValue({ data: null, isPending: false });
  accept.mockReset();
  signIn.mockReset();
  navigate.mockReset();
  refetch.mockReset();
});

describe('AcceptInvite', () => {
  it('says who asked, to which workspace, and as what', () => {
    showing();

    expect(
      screen.getByRole('heading', {
        name: 'Leon Liang invited you to Acme',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('You join as a member, on the Platform team.'),
    ).toBeInTheDocument();
  });

  it('says someone who has left asked, where their account is gone', () => {
    invite.mockReturnValue(offered({ invitedBy: null }));
    showing();

    expect(
      screen.getByRole('heading', {
        name: 'Someone who has left invited you to Acme',
      }),
    ).toBeInTheDocument();
  });

  it('names every team an invitation joins', () => {
    invite.mockReturnValue(
      offered({ teamNames: ['Platform', 'Growth', 'Mobile'] }),
    );
    showing();

    expect(
      screen.getByText(
        'You join as a member, on the Platform, Growth and Mobile teams.',
      ),
    ).toBeInTheDocument();
  });

  it('says an admin invitation onto no team joins the workspace only', () => {
    invite.mockReturnValue(offered({ role: 'admin', teamNames: [] }));
    showing();

    expect(
      screen.getByText('You join as an admin of the workspace on Spotlight.'),
    ).toBeInTheDocument();
  });

  it('asks somebody signed out to sign in with GitHub', async () => {
    showing();

    expect(screen.queryByText(/Sign in as/)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Continue with GitHub' }),
    );

    expect(signIn).toHaveBeenCalledWith('/invites/tok-123');
  });

  it('takes the invitation up and lands in the workspace’s inbox', async () => {
    session.mockReturnValue({
      data: { user: { email: 'ada@example.com' } },
      isPending: false,
    });
    accept.mockImplementation((_, { onSuccess }) =>
      onSuccess({ workspaceSlug: 'acme' }),
    );
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Accept invitation' }),
    );

    expect(navigate).toHaveBeenCalledWith('/w/acme/inbox', {
      replace: true,
    });
  });

  it('takes an address in any case as the same account', () => {
    session.mockReturnValue({
      data: { user: { email: 'Ada@Example.COM' } },
      isPending: false,
    });
    showing();

    expect(
      screen.getByRole('button', { name: 'Accept invitation' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
      screen.getByText(/The invitation is for ada@example.com, not /),
    ).toBeInTheDocument();
  });

  it.each([
    ['accepted', 'This invitation is already accepted.'],
    ['revoked', 'This invitation is withdrawn.'],
    ['expired', 'This invitation has expired. Please ask for a new one.'],
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
      data: null,
      isPending: false,
      errorUpdateCount: 0,
    });
    showing();

    expect(
      screen.getByRole('heading', {
        name: 'Invitation link doesn’t work',
      }),
    ).toBeInTheDocument();
  });

  it('shows nothing while the invitation is read', () => {
    invite.mockReturnValue({
      data: undefined,
      isPending: true,
      errorUpdateCount: 0,
    });
    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing while the session is read', () => {
    session.mockReturnValue({ data: null, isPending: true });
    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });

  it('says the invitation could not be loaded, and tries again when asked', async () => {
    invite.mockReturnValue({
      data: undefined,
      isPending: false,
      errorUpdateCount: 1,
      isFetching: false,
      refetch,
    });
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The invitation could not be loaded.',
    );
    expect(
      screen.queryByRole('heading', {
        name: 'Invitation link doesn’t work',
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
