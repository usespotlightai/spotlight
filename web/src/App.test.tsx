import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { client } from '@/lib/api/client.gen';
import App from './App';

beforeAll(() => {
  client.setConfig({ baseUrl: 'http://localhost/api' });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Hello World!' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
});

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('routing', () => {
  it('renders the home route at /', () => {
    renderAt('/');

    expect(
      screen.getByRole('heading', { name: 'Get started' }),
    ).toBeInTheDocument();
  });

  it('renders the about route at /about', () => {
    renderAt('/about');

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
  });

  it('falls back to the catch-all route for an unknown path', () => {
    renderAt('/no-such-page');

    expect(
      screen.getByRole('heading', { name: 'Not found' }),
    ).toBeInTheDocument();
    expect(screen.getByText('/no-such-page')).toBeInTheDocument();
  });

  it('marks only the matching nav link as active', () => {
    renderAt('/about');

    expect(screen.getByRole('link', { name: 'About' })).toHaveClass(
      'nav-link--active',
    );
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveClass(
      'nav-link--active',
    );
  });

  it('navigates client-side when a nav link is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('link', { name: 'About' }));

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
  });
});

describe('about route', () => {
  it('renders the greeting fetched from the control-plane', async () => {
    renderAt('/about');

    expect(await screen.findByText('Hello World!')).toBeInTheDocument();
  });

  it('shows an alert when the control-plane cannot be reached', async () => {
    vi.mocked(fetch).mockImplementationOnce(
      async () => new Response('', { status: 500 }),
    );

    renderAt('/about');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
