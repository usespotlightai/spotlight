import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { Workspace } from '@/routes/Workspace';

vi.mock('@/hooks/api/useWorkspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/hooks/api/useSignOut', () => ({
  useSignOut: () => ({ mutate: vi.fn(), isPending: false }),
}));

const mockWorkspace = vi.mocked(useWorkspace);

const loaded = (data: unknown) =>
  mockWorkspace.mockReturnValue({ data, isPending: false } as never);

const acme = {
  id: 'ws_1',
  name: 'Acme Inc.',
  slug: 'acme-inc',
  teams: [{ id: 'team_1', name: 'Acme Inc.' }],
};

const renderAt = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/w/${slug}`]}>
      <Routes>
        <Route path="/w/:slug" element={<Workspace />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockWorkspace.mockReset();
});

describe('Workspace', () => {
  it('names the workspace at that address', () => {
    loaded(acme);

    renderAt('acme-inc');

    expect(
      screen.getByRole('heading', { name: 'Acme Inc.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('usespotlight.ai/w/acme-inc')).toBeInTheDocument();
  });

  it('lists the teams it holds', () => {
    loaded(acme);

    renderAt('acme-inc');

    expect(screen.getByRole('listitem')).toHaveTextContent('Acme Inc.');
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
