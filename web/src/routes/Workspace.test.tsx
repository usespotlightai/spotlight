import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { Workspace } from '@/routes/Workspace';

vi.mock('@/hooks/api/useWorkspace', () => ({ useWorkspace: vi.fn() }));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [{ id: 'line_1', name: 'Default', stations: [] }],
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({ data: [], isPending: false }),
}));
vi.mock('@/hooks/api/useSignOut', () => ({
  useSignOut: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/api/useWorkspaces', () => ({
  useWorkspaces: () => ({ data: [], isPending: false }),
}));
vi.mock('@/hooks/api/useInbox', () => ({
  inboxKeys: { forWorkspace: () => ['inbox'] },
  useInbox: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useRunners', () => ({
  runnerKeys: { all: ['runners'] },
  useRunners: () => ({
    isPending: false,
    errorUpdateCount: 0,
    data: [
      {
        id: 'r1',
        name: 'one',
        pool: 'dev',
        connected: true,
        currentRun: null,
      },
      {
        id: 'r2',
        name: 'two',
        pool: 'dev',
        connected: true,
        currentRun: { id: 'run_1' },
      },
      {
        id: 'r3',
        name: 'three',
        pool: 'dev',
        connected: false,
        currentRun: null,
      },
    ],
  }),
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { email: 'dev@example.com' } } }),
}));

const mockWorkspace = vi.mocked(useWorkspace);

const refetch = vi.fn();

const answered = (over: Record<string, unknown>) =>
  mockWorkspace.mockReturnValue({
    data: undefined,
    isPending: false,
    errorUpdateCount: 0,
    isFetching: false,
    refetch,
    ...over,
  } as never);

const loaded = (data: unknown) => answered({ data });

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
  refetch.mockClear();
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

  it('leaves the sidebar blank while the workspace loads, but not the page', () => {
    answered({ isPending: true });

    renderAt('acme-inc');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Your teams' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Inbox/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('section slot')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Workspace not found' }),
    ).not.toBeInTheDocument();
  });

  it('says the workspace could not be loaded, and tries again when asked', async () => {
    const person = userEvent.setup();
    answered({ errorUpdateCount: 1 });

    renderAt('acme-inc');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The workspace could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('section slot')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Workspace not found' }),
    ).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the workspace it has when a later refresh fails', () => {
    answered({ data: acme, errorUpdateCount: 1 });

    renderAt('acme-inc');

    expect(
      screen.getByRole('button', { name: /Acme Inc\./ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('counts every runner the control plane can still hear from', () => {
    loaded(acme);

    renderAt('acme-inc');

    const runners = screen.getByRole('link', { name: /Runners/ });
    expect(runners).toHaveTextContent('2');
  });
});
