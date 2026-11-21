import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicStackGate } from '@/components/shell/auth/PublicStackGate';
import { useSession } from '@/hooks/api/useSession';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';

vi.mock('@/hooks/api/useSession', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/api/useWorkspaces', () => ({ useWorkspaces: vi.fn() }));
vi.mock('@/routes/PublicChangeStack', () => ({
  PublicChangeStack: () => <p>public change stack</p>,
}));

const mockSession = vi.mocked(useSession);
const mockWorkspaces = vi.mocked(useWorkspaces);

const TASK_URL = '/w/acme/team/team_1/tasks/task_1/changes';
const RUN_URL = '/w/acme/team/team_1/runs/run_1/changes';

const anonymous = () =>
  mockSession.mockReturnValue({ data: null, isPending: false } as never);

const signedIn = () =>
  mockSession.mockReturnValue({
    data: { user: { id: 'user_1', email: 'dev@example.com' } },
    isPending: false,
  } as never);

const memberOf = (...slugs: string[]) =>
  mockWorkspaces.mockReturnValue({
    data: slugs.map((slug) => ({ id: `ws_${slug}`, name: slug, slug })),
    isPending: false,
    errorUpdateCount: 0,
  } as never);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<PublicStackGate />}>
            <Route path="/w/:slug/*" element={<p>private page</p>} />
            <Route path="/" element={<p>home</p>} />
          </Route>
        </Routes>
      </Suspense>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockSession.mockReset();
  mockWorkspaces.mockReset();
  memberOf('acme');
});

describe('PublicStackGate', () => {
  it.each([
    ['a task', TASK_URL],
    ['a run', RUN_URL],
  ])('shows an anonymous visitor the public view of %s', async (_, url) => {
    anonymous();

    renderAt(url);

    expect(await screen.findByText('public change stack')).toBeInTheDocument();
    expect(screen.queryByText('private page')).toBeNull();
  });

  it('shows a member of the workspace the private page', () => {
    signedIn();

    renderAt(TASK_URL);

    expect(screen.getByText('private page')).toBeInTheDocument();
  });

  it('shows a signed-in person who is not in the workspace the public view', async () => {
    signedIn();
    memberOf('other');

    renderAt(RUN_URL);

    expect(await screen.findByText('public change stack')).toBeInTheDocument();
  });

  it('shows nothing while the session is unknown', () => {
    mockSession.mockReturnValue({ data: undefined, isPending: true } as never);

    const { container } = renderAt(TASK_URL);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing while the workspaces of a signed-in person load', () => {
    signedIn();
    mockWorkspaces.mockReturnValue({
      data: undefined,
      isPending: true,
      errorUpdateCount: 0,
    } as never);

    const { container } = renderAt(TASK_URL);

    expect(container).toBeEmptyDOMElement();
  });

  it('leaves the page to the private route when the workspaces fail to load', () => {
    signedIn();
    mockWorkspaces.mockReturnValue({
      data: undefined,
      isPending: false,
      errorUpdateCount: 1,
    } as never);

    renderAt(TASK_URL);

    expect(screen.getByText('private page')).toBeInTheDocument();
  });

  it('leaves any other address to the private route, also for an anonymous visitor', () => {
    anonymous();

    renderAt('/w/acme/team/team_1/tasks/task_1');

    expect(screen.getByText('private page')).toBeInTheDocument();
    expect(screen.queryByText('public change stack')).toBeNull();
  });

  it('asks for the workspaces of a signed-in person only on a change stack address', () => {
    signedIn();

    renderAt('/');

    expect(mockWorkspaces).toHaveBeenLastCalledWith(false);
  });
});
