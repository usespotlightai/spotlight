import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOO_MANY_ATTEMPTS } from '@/lib/device';
import { AuthorizeDevice } from '@/routes/AuthorizeDevice';

const device = vi.fn();
const session = vi.fn();
const decide = vi.fn();
const signIn = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useDeviceCode', () => ({
  useDeviceCode: (userCode: string | null, signedIn: boolean) =>
    device(userCode, signedIn),
}));

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => session(),
}));

vi.mock('@/hooks/api/useDecideDevice', () => ({
  useDecideDevice: () => ({
    mutate: decide,
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/api/useSignIn', () => ({
  useSignIn: (callbackURL: string) => ({
    mutate: () => signIn(callbackURL),
    isPending: false,
  }),
}));

function Where() {
  const location = useLocation();

  return <output aria-label="Location">{location.search}</output>;
}

const showing = (at = '/device?user_code=WDJBMJHT') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route
          path="/device"
          element={
            <>
              <AuthorizeDevice />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const status = (data: unknown) => ({
  data,
  isPending: false,
  errorUpdateCount: 0,
  isFetching: false,
  refetch,
});

const SIGNED_IN = {
  data: { user: { email: 'ada@example.com' } },
  isPending: false,
};

beforeEach(() => {
  device.mockReturnValue(status('pending'));
  session.mockReturnValue(SIGNED_IN);
  decide.mockReset();
  signIn.mockReset();
  refetch.mockReset();
});

describe('AuthorizeDevice', () => {
  it('shows the code to compare with the terminal, and who the CLI acts as', () => {
    showing();

    expect(
      screen.getByRole('heading', { name: 'Approve the Spotlight CLI?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('WDJB-MJHT')).toBeInTheDocument();
    expect(
      screen.getByText(/The CLI acts as ada@example.com in every workspace/),
    ).toBeInTheDocument();
  });

  it('approves the code', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(decide).toHaveBeenCalledWith('approve');
  });

  it('denies the code', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Deny' }));

    expect(decide).toHaveBeenCalledWith('deny');
  });

  it('asks somebody signed out to log in, and comes back to the same code', async () => {
    session.mockReturnValue({ data: null, isPending: false });
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Continue with GitHub' }),
    );

    expect(signIn).toHaveBeenCalledWith('/device?user_code=WDJBMJHT');
    expect(device).toHaveBeenCalledWith('WDJBMJHT', false);
  });

  it('asks for the code when the link has none', async () => {
    showing('/device');

    await userEvent.type(screen.getByLabelText('Code'), 'wdjb-mjht');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByLabelText('Location')).toHaveTextContent(
      '?user_code=WDJBMJHT',
    );
  });

  it('says a code that is expired or unknown does not work', () => {
    device.mockReturnValue(status(null));
    showing();

    expect(
      screen.getByRole('heading', { name: 'Code doesn’t work' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['approved', 'Spotlight CLI is logged in'],
    ['denied', 'Login denied'],
  ])('says a code that is %s is decided', (decided, heading) => {
    device.mockReturnValue(status(decided));
    showing();

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
  });

  it('says to wait, without a retry, when there were too many attempts', () => {
    device.mockReturnValue({
      data: undefined,
      error: new Error(TOO_MANY_ATTEMPTS),
      isPending: false,
      errorUpdateCount: 1,
      isFetching: false,
      refetch,
    });
    showing();

    expect(
      screen.getByRole('heading', { name: 'Too many attempts' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('offers to check the code again when the check fails', async () => {
    device.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      errorUpdateCount: 1,
      isFetching: false,
      refetch,
    });
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
