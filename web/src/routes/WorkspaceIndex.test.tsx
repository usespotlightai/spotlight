import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { WorkspaceIndex } from '@/routes/WorkspaceIndex';

describe('WorkspaceIndex', () => {
  it('opens the workspace on its inbox', () => {
    render(
      <MemoryRouter initialEntries={['/w/acme']}>
        <Routes>
          <Route path="/w/:slug" element={<WorkspaceIndex />} />
          <Route path="/w/:slug/inbox" element={<p>inbox page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('inbox page')).toBeInTheDocument();
  });
});
