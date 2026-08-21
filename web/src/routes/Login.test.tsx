import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/lib/authClient';
import { Login } from '@/routes/Login';

vi.mock('@/lib/authClient', () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

const signInEmail = vi.mocked(authClient.signIn.email);

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/sign-in']}>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  signInEmail.mockReset();
});

describe('Login', () => {
  it('submits the credentials the user typed', async () => {
    signInEmail.mockResolvedValue({
      data: { token: 't' },
      error: null,
    } as never);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Email'), 'dev@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(signInEmail).toHaveBeenCalledWith({
      email: 'dev@example.com',
      password: 'correct-horse-battery',
    });
  });

  it('renders the server error', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email or password', status: 401 },
    } as never);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Email'), 'dev@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    );
  });

  it('labels both fields for assistive tech despite showing only placeholders', () => {
    renderPage();

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
  });
});
