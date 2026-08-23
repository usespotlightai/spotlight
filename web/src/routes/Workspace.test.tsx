import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { Workspace } from '@/routes/Workspace';

vi.mock('@/hooks/api/useWorkspace', () => ({ useWorkspace: vi.fn() }));

vi.mock('@/hooks/api/useAssemblyLines', () => ({
  useAssemblyLines: () => ({
    data: [{ id: 'line_1', name: 'Default', stations: [] }],
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useSignOut', () => ({
  useSignOut: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/api/useWorkspaces', () => ({
  useWorkspaces: () => ({ data: [], isPending: false }),
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { email: 'dev@example.com' } } }),
}));

const mockWorkspace = vi.mocked(useWorkspace);

const loaded = (data: unknown) =>
  mockWorkspace.mockReturnValue({ data, isPending: false } as never);

const acme = {
  id: 'ws_1',
  name: 'Acme Inc.',
  slug: 'acme-inc',
  teams: [{ id: 'team_1', name: 'Platform' }],
};

const renderAt = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/w/${slug}`]}>
      <Routes>
        <Route path="/w/:slug" element={<Workspace />}>
          <Route index element={<p>section slot</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockWorkspace.mockReset();
});

describe('Workspace', () => {
  it('names the workspace at that address in the sidebar', () => {
    loaded(acme);

    renderAt('acme-inc');

    expect(
      screen.getByRole('button', { name: /Acme Inc\./ }),
    ).toBeInTheDocument();
  });

  it('frames the section at that address', () => {
    loaded(acme);

    renderAt('acme-inc');

    expect(screen.getByText('section slot')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Default' })).toHaveAttribute(
      'href',
      '/w/acme-inc/team/team_1/lines/line_1',
    );
  });

  it('asks by the slug in the address', () => {
    loaded(acme);

    renderAt('acme-inc');

    expect(mockWorkspace).toHaveBeenCalledWith('acme-inc');
  });

  it('says so when the workspace is not the caller’s to read', () => {
    loaded(null);

    renderAt('someone-elses');

    expect(
      screen.getByRole('heading', { name: 'Workspace not found' }),
    ).toBeInTheDocument();
  });

  it('waits rather than claiming absence while it loads', () => {
    mockWorkspace.mockReturnValue({
      data: undefined,
      isPending: true,
    } as never);

    renderAt('acme-inc');

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
