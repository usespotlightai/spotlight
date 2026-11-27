import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceSidebar } from '@/components/shell/layout/WorkspaceSidebar';

const inbox = vi.fn<() => { unread: boolean }[] | undefined>();

vi.mock('@/hooks/api/useInbox', () => ({
  useInbox: () => ({ data: inbox() }),
}));
vi.mock('@/components/shell/layout/TeamNav', () => ({ TeamNav: () => null }));
vi.mock('@/components/shell/layout/WorkspaceMenu', () => ({
  WorkspaceMenu: () => null,
}));
vi.mock('@/components/shell/layout/SidebarSearch', () => ({
  SidebarSearch: () => null,
}));

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <WorkspaceSidebar
        slug="acme-inc"
        workspace={{
          id: 'ws_1',
          name: 'Acme',
          avatarUrl: null,
          role: 'member',
          teams: [],
        }}
        onSearch={() => {}}
      />
    </MemoryRouter>,
  );

describe('WorkspaceSidebar', () => {
  it('says that the inbox badge counts the unread items', () => {
    inbox.mockReturnValue([
      { unread: true },
      { unread: false },
      { unread: true },
    ]);

    renderSidebar();

    expect(
      screen.getByRole('link', { name: /^Inbox\s*2 unread$/ }),
    ).toBeInTheDocument();
  });

  it('shows no badge while nothing is unread', () => {
    inbox.mockReturnValue([{ unread: false }]);

    renderSidebar();

    expect(screen.getByRole('link', { name: 'Inbox' })).toBeInTheDocument();
  });
});
