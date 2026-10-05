import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useClearedParam } from '@/hooks/useClearedParam';

function Clearing() {
  useClearedParam('connected');
  const { pathname, search } = useLocation();

  return <p>{`${pathname}${search}`}</p>;
}

const at = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/w/:slug/inbox/:itemId" element={<Clearing />} />
      </Routes>
    </MemoryRouter>,
  );

describe('useClearedParam', () => {
  it('takes the param off the address, keeping the rest', async () => {
    at('/w/acme/inbox/task_1:0?connected=linear&tab=work');

    expect(
      await screen.findByText('/w/acme/inbox/task_1:0?tab=work'),
    ).toBeInTheDocument();
  });

  it('leaves an address without it alone', () => {
    at('/w/acme/inbox/task_1:0');

    expect(screen.getByText('/w/acme/inbox/task_1:0')).toBeInTheDocument();
  });
});
