import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageErrorBoundary } from '@/components/shell/layout/PageErrorBoundary';

let broken = true;
let mounted = 0;

function Page() {
  if (broken) {
    throw new Error('the page broke');
  }
  return <p>The page</p>;
}

function Counted() {
  useEffect(() => {
    mounted += 1;
  }, []);
  return <Page />;
}

afterEach(() => {
  broken = true;
  mounted = 0;
});

describe('PageErrorBoundary', () => {
  it('shows a page that failed to render as could not be loaded, and tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <PageErrorBoundary>
          <Page />
        </PageErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This page could not be loaded.',
    );

    broken = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('The page')).toBeInTheDocument();
  });

  it('keeps a page that renders mounted while the path changes, and clears a failure when it changes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/a']}>
        <Link to="/b">Somewhere else</Link>
        <Link to="/c">Further on</Link>
        <PageErrorBoundary>
          <Routes>
            <Route path="*" element={<Counted />} />
          </Routes>
        </PageErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    broken = false;
    await userEvent.click(screen.getByRole('link', { name: 'Somewhere else' }));

    expect(screen.getByText('The page')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Further on' }));

    expect(screen.getByText('The page')).toBeInTheDocument();
    expect(mounted).toBe(1);
  });
});
