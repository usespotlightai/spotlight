import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/lib/authClient';
import { SignUp } from '@/routes/SignUp';

vi.mock('@/lib/authClient', () => ({
  authClient: { signUp: { email: vi.fn() } },
}));

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const signUpEmail = vi.mocked(authClient.signUp.email);

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/signup']}>
        <SignUp />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  signUpEmail.mockReset();
  navigate.mockReset();
});

describe('SignUp', () => {
  it('submits name, email and password', async () => {
    signUpEmail.mockResolvedValue({
      data: { token: 't' },
      error: null,
    } as never);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Name'), 'Dev User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(signUpEmail).toHaveBeenCalledWith({
      name: 'Dev User',
      email: 'new@example.com',
      password: 'correct-horse-battery',
    });
  });

  it('renders the server error', async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: {
        message: 'User already exists. Use another email.',
        status: 422,
      },
    } as never);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Name'), 'Dev User');
    await user.type(screen.getByLabelText('Email'), 'dev@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User already exists',
    );
  });

  it('labels all three fields and links back to sign in', () => {
    renderPage();

    expect(screen.getByLabelText('Name')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('replaces the form in history so Back does not return to it', async () => {
    signUpEmail.mockResolvedValue({
      data: { token: 't' },
      error: null,
    } as never);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Name'), 'Dev User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/workspaces/new', {
        replace: true,
      }),
    );
  });
});
