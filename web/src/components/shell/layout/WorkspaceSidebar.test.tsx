import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceSidebar } from '@/components/shell/layout/WorkspaceSidebar';

const inbox =
  vi.fn<() => { unread: boolean; unreadCount: number }[] | undefined>();

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
  it('counts in the badge everything unread, as the items count it', () => {
    inbox.mockReturnValue([
      { unread: true, unreadCount: 4 },
      { unread: false, unreadCount: 0 },
      { unread: true, unreadCount: 1 },
    ]);

    renderSidebar();

    expect(
      screen.getByRole('link', { name: /^Inbox\s*5 unread$/ }),
    ).toBeInTheDocument();
  });

  it('shows no badge while nothing is unread', () => {
    inbox.mockReturnValue([{ unread: false, unreadCount: 0 }]);

    renderSidebar();

    expect(screen.getByRole('link', { name: 'Inbox' })).toBeInTheDocument();
  });
});
