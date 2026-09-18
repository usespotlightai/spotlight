import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      errorUpdateCount: 0,
    } as never);

    renderIndex();

    expect(screen.getByText('workspace page')).toBeInTheDocument();
  });

  it('renders nothing while the list is still loading', () => {
    mockWorkspaces.mockReturnValue({
      data: undefined,
      isPending: true,
      errorUpdateCount: 0,
    } as never);

    renderIndex();
    expect(screen.queryByText('workspace page')).not.toBeInTheDocument();
    expect(screen.queryByText('workspace setup')).not.toBeInTheDocument();
  });

  it('falls back to setup for a member of no workspace', () => {
    mockWorkspaces.mockReturnValue({
      data: [],
      isPending: false,
      errorUpdateCount: 0,
    } as never);

    renderIndex();

    expect(screen.getByText('workspace setup')).toBeInTheDocument();
  });

  it('says the workspaces could not be loaded rather than offering to create one', async () => {
    const refetch = vi.fn();
    mockWorkspaces.mockReturnValue({
      data: undefined,
      isPending: false,
      errorUpdateCount: 1,
      isFetching: false,
      refetch,
    } as never);

    renderIndex();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your workspaces could not be loaded.',
    );
    expect(screen.queryByText('workspace setup')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
