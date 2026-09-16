import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/lib/authClient';
import { Login } from '@/routes/Login';

vi.mock('@/lib/authClient', () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

const signInSocial = vi.mocked(authClient.signIn.social);

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  signInSocial.mockReset();
});

describe('Login', () => {
  it('sends the person to GitHub', async () => {
    signInSocial.mockResolvedValue({
      data: { redirect: true },
      error: null,
    } as never);
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Continue with GitHub' }),
    );

    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'github',
      callbackURL: '/',
    });
  });

  it('says sign-in failed in plain words rather than repeating the server', async () => {
    signInSocial.mockResolvedValue({
      data: null,
      error: { message: 'GitHub is not reachable', status: 502 },
    } as never);
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Continue with GitHub' }),
    );

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(
      'We couldn’t sign you in. Please try again later.',
    );
    expect(alert).not.toHaveTextContent('GitHub is not reachable');
  });

  it('offers no other way in', () => {
    renderPage();

    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
