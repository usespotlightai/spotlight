import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from './App';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
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
