import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';
import { DefaultWorkspace } from '@/routes/DefaultWorkspace';

vi.mock('@/hooks/api/useWorkspaces', () => ({ useWorkspaces: vi.fn() }));

const mockWorkspaces = vi.mocked(useWorkspaces);

const renderIndex = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route index element={<DefaultWorkspace />} />
        <Route path="/w/:slug" element={<p>workspace page</p>} />
        <Route path="/workspaces/new" element={<p>workspace setup</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockWorkspaces.mockReset();
});

describe('DefaultWorkspace', () => {
  it('sends the caller to their oldest workspace', () => {
    mockWorkspaces.mockReturnValue({
      data: [
        { id: 'ws_1', name: 'Acme', slug: 'acme' },
        { id: 'ws_2', name: 'Later', slug: 'later' },
      ],
      isPending: false,
    } as never);

    renderIndex();

    expect(screen.getByText('workspace page')).toBeInTheDocument();
  });

  it('renders nothing while the list is still loading', () => {
    mockWorkspaces.mockReturnValue({
      data: undefined,
      isPending: true,
    } as never);

    renderIndex();

    expect(screen.queryByText('workspace page')).not.toBeInTheDocument();
    expect(screen.queryByText('workspace setup')).not.toBeInTheDocument();
  });

  it('falls back to setup for a member of no workspace', () => {
    mockWorkspaces.mockReturnValue({ data: [], isPending: false } as never);

    renderIndex();

    expect(screen.getByText('workspace setup')).toBeInTheDocument();
  });
});
