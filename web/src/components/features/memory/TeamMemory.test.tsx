import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamMemory } from '@/components/features/memory/TeamMemory';
import type { TeamMemory as Memory, MemoryFilter } from '@/lib/memory';

const refetch = vi.fn();
const requested: MemoryFilter[] = [];
const memoriesState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch,
};

vi.mock('@/hooks/api/useTeamMemories', () => ({
  useTeamMemories: (_teamId: string, filter: MemoryFilter) => {
    requested.push(filter);
    return memoriesState;
  },
}));
const linesState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch: vi.fn(),
};
const LINES = [
  {
    id: 'line_delivery',
    key: 'delivery',
    name: 'Delivery',
    stations: [{ id: 'station_build', name: 'Implementation', kind: 'work' }],
    reactions: [],
    repositories: [
      {
        fullName: 'acme/api',
        host: 'github',
        url: 'https://github.com/acme/api',
      },
    ],
  },
];

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => linesState,
}));
vi.mock('@/components/features/memory/WriteMemoryButton', () => ({
  WriteMemoryButton: () => <button type="button">Write a memory</button>,
}));
vi.mock('@/components/features/memory/MemorySource', () => ({
  MemorySource: () => null,
}));
const mutate = vi.fn();

vi.mock('@/hooks/api/useWriteMemory', () => ({
  useWriteMemory: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { name: 'Ada Lovelace', image: null } } }),
}));
vi.mock('@/hooks/api/useEditMemory', () => ({
  useEditMemory: () => ({ mutate, reset: vi.fn(), isPending: false }),
}));
vi.mock('@/components/features/memory/MemoryDetails', () => ({
  MemoryDetails: ({
    memoryId,
    editing,
    onEdit,
    onSave,
  }: {
    memoryId: string;
    editing: boolean;
    onEdit: () => void;
    onSave: () => void;
  }) => (
    <div>
      <p>Details of {memoryId}</p>
      {editing ? (
        <button type="button" onClick={onSave}>
          Save
        </button>
      ) : (
        <button type="button" onClick={onEdit}>
          Edit
        </button>
      )}
    </div>
  ),
}));

const visibleRows = () =>
  Array.from(document.querySelectorAll('[data-slot="team-memory"]'));

const memory = (over: Partial<Memory> = {}): Memory => ({
  id: 'memory_1',
  handle: 'M-1',
  kind: 'preference',
  body: 'Name branches after the ticket.',
  source: 'person',
  status: 'active',
  scope: 'team',
  lineId: null,
  stationId: null,
  repository: null,
  paths: [],
  approvedBy: { id: 'user_2', name: 'Maya Chen', image: null },
  approvedAt: '2026-09-27T10:00:00.000Z',
  supersedes: null,
  retirement: null,
  provenance: null,
  runs: 0,
  ...over,
});

function Where() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <output aria-label="Where">{location.search}</output>
      <button type="button" onClick={() => navigate('?memory=memory_2')}>
        Follow a link to memory_2
      </button>
    </>
  );
}

const showing = (at = '/w/acme/team/team_1/memory') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/memory"
          element={
            <>
              <TeamMemory slug="acme" teamId="team_1" />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  requested.length = 0;
  memoriesState.data = undefined;
  memoriesState.isPending = false;
  memoriesState.errorUpdateCount = 0;
  linesState.data = LINES;
  linesState.isPending = false;
  linesState.errorUpdateCount = 0;
});

describe('TeamMemory', () => {
  it('lists every active memory, saying where it applies and who approved it', () => {
    memoriesState.data = [
      memory(),
      memory({
        id: 'memory_2',
        body: 'Retry uploads in the request.',
        kind: 'rationale',
        source: 'run',
        lineId: 'line_delivery',
        stationId: 'station_build',
        repository: 'acme/api',
        paths: ['src/uploads.ts'],
      }),
    ];

    showing();

    expect(visibleRows()).toHaveLength(2);
    const places = screen.getAllByRole('list', { name: 'Where it applies' });
    expect(places[0]).toHaveTextContent('The whole team');
    expect(places[1]).toHaveTextContent(
      'Delivery › Implementation › acme/api › src/uploads.ts',
    );
    expect(screen.getAllByText('Maya Chen')).toHaveLength(2);
    expect(requested[0]?.status).toBe('active');
  });

  it('requests the retired memories, and says why each was retired', async () => {
    memoriesState.data = [
      memory({
        status: 'retired',
        retirement: {
          at: '2026-09-27T11:00:00.000Z',
          by: { id: 'user_2', name: 'Maya Chen', image: null },
          reason: 'It was fixed.',
          supersededBy: null,
        },
      }),
    ];

    showing('/w/acme/team/team_1/memory?status=retired');

    expect(requested[0]?.status).toBe('retired');
    await userEvent.click(
      screen.getByRole('button', { name: /Name branches after the ticket/ }),
    );
    const why = screen.getByRole('figure', { name: 'Why it was retired' });
    expect(within(why).getByText('Maya Chen')).toBeVisible();
    expect(within(why).getByText('retired this')).toBeVisible();
    expect(within(why).getByText('It was fixed.')).toBeVisible();
  });

  it('shows the retired memories on request, held in the address', async () => {
    memoriesState.data = [memory()];
    showing();

    await userEvent.click(screen.getByRole('link', { name: 'Retired' }));

    expect(screen.getByRole('status', { name: 'Where' })).toHaveTextContent(
      '?status=retired',
    );
  });

  it('collapses a branch of where an opened memory applies', async () => {
    memoriesState.data = [
      memory({
        lineId: 'line_delivery',
        stationId: 'station_build',
        repository: 'acme/api',
        paths: ['src/uploads.ts'],
      }),
    ];
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: /Name branches after the ticket/ }),
    );
    const toggle = screen.getByRole('button', {
      name: 'Hide what is under acme/api',
    });
    await userEvent.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Show what is under acme/api' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('edits a memory in its own row, keeping where it applies', async () => {
    memoriesState.data = [
      memory({
        lineId: 'line_delivery',
        stationId: 'station_build',
        repository: 'acme/api',
        paths: ['src/uploads.ts'],
      }),
    ];
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: /Name branches after the ticket/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const body = screen.getByRole('textbox', {
      name: 'What the team should remember',
    });
    expect(screen.getByRole('button', { name: /^Kind:/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Paths' })).toHaveValue(
      'src/uploads.ts',
    );

    await userEvent.clear(body);
    await userEvent.type(body, 'Name branches after the issue.');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutate).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        memoryId: 'memory_1',
        memory: expect.objectContaining({
          body: 'Name branches after the issue.',
          lineId: 'line_delivery',
          stationId: 'station_build',
          repository: 'acme/api',
          paths: ['src/uploads.ts'],
        }),
      },
      expect.anything(),
    );
  });

  it('opens and closes a memory wherever its row is clicked', async () => {
    memoriesState.data = [memory()];
    showing();
    const toggle = screen.getByRole('button', {
      name: /Name branches after the ticket/,
    });

    await userEvent.click(screen.getByText('Maya Chen'));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(
      screen.getByRole('textbox', { name: 'What the team should remember' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('Maya Chen'));
    expect(
      screen.getByRole('textbox', { name: 'What the team should remember' }),
    ).toBeInTheDocument();
  });

  it('keeps one memory open at a time', async () => {
    memoriesState.data = [
      memory(),
      memory({ id: 'memory_2', body: 'Retry uploads in the request.' }),
    ];
    showing();
    const first = screen.getByRole('button', {
      name: /Name branches after the ticket/,
    });
    const second = screen.getByRole('button', {
      name: /Retry uploads in the request/,
    });

    await userEvent.click(first);
    await userEvent.click(second);

    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(second);

    expect(second).toHaveAttribute('aria-expanded', 'false');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('writes a new memory in a row at the top, even when there are none', async () => {
    memoriesState.data = [];
    showing('/w/acme/team/team_1/memory?write=1');

    expect(
      screen.getByRole('listitem', { name: 'Write a memory' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('status', { name: 'Where' })).toHaveTextContent('');
    expect(screen.getByText('No memories yet')).toBeInTheDocument();
  });

  it('opens a memory to show more about it', async () => {
    memoriesState.data = [memory()];
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: /Name branches after the ticket/ }),
    );

    expect(screen.getByText('Details of memory_1')).toBeInTheDocument();
  });

  it('invites writing the first memory when the team remembers nothing', () => {
    memoriesState.data = [];
    showing();

    expect(screen.getByText('No memories yet')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Write a memory' }),
    ).toBeVisible();
  });

  it('still offers the retired memories when none is active', async () => {
    memoriesState.data = [];
    showing();

    await userEvent.click(screen.getByRole('link', { name: 'Retired' }));

    expect(screen.getByRole('status', { name: 'Where' })).toHaveTextContent(
      '?status=retired',
    );
  });

  it('says nothing matches rather than inviting a first memory when filtered', () => {
    memoriesState.data = [];
    showing('/w/acme/team/team_1/memory?kind=failure');

    expect(screen.getByText('No memories match.')).toBeVisible();
  });

  it('keeps its shape while it loads', () => {
    memoriesState.isPending = true;
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the team’s memory' }),
    ).toBeInTheDocument();
  });

  it('offers to try again when the memory could not be loaded', async () => {
    memoriesState.errorUpdateCount = 1;
    showing();

    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));

    expect(refetch).toHaveBeenCalled();
  });

  it('shows how many runs have used each memory', () => {
    memoriesState.data = [
      memory({ runs: 3 }),
      memory({ id: 'memory_2', body: 'Unused.' }),
    ];

    showing();

    const rows = visibleRows();
    expect(rows[0]).toHaveTextContent(/3$/);
    expect(rows[1]).toHaveTextContent(/0$/);
  });

  it('opens the memory a link names, among the rest', () => {
    memoriesState.data = [
      memory(),
      memory({ id: 'memory_9', body: 'The one linked.' }),
    ];

    showing('/w/acme/team/team_1/memory?memory=memory_9');

    expect(visibleRows()).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'The one linked.' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Details of memory_9')).toBeInTheDocument();
    expect(screen.queryByText('Details of memory_1')).not.toBeInTheDocument();
  });

  it('starts a collapsed memory afresh, not in the edit it was left in', async () => {
    memoriesState.data = [
      memory(),
      memory({ id: 'memory_2', body: 'Retry uploads in the request.' }),
    ];
    showing();
    const first = screen.getByRole('button', {
      name: /Name branches after the ticket/,
    });

    await userEvent.click(first);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(
      screen.getByRole('button', { name: /Retry uploads in the request/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Name branches after the ticket/ }),
    );

    expect(
      screen.queryByRole('textbox', { name: 'What the team should remember' }),
    ).not.toBeInTheDocument();
    expect(
      within(visibleRows()[0] as HTMLElement).getByRole('button', {
        name: 'Edit',
      }),
    ).toBeInTheDocument();
  });

  it('opens whichever memory a later link names', async () => {
    memoriesState.data = [
      memory(),
      memory({ id: 'memory_2', body: 'Retry uploads in the request.' }),
    ];
    showing('/w/acme/team/team_1/memory?memory=memory_1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Follow a link to memory_2' }),
    );

    expect(
      screen.getByRole('button', { name: /Retry uploads in the request/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: /Name branches after the ticket/ }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps its shape while the lines load', () => {
    memoriesState.data = [memory({ lineId: 'line_delivery' })];
    linesState.data = undefined;
    linesState.isPending = true;
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the team’s memory' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Line deleted')).not.toBeInTheDocument();
  });

  it('offers to try again when the lines could not be loaded', async () => {
    memoriesState.data = [memory()];
    linesState.data = undefined;
    linesState.errorUpdateCount = 1;
    showing();

    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));

    expect(linesState.refetch).toHaveBeenCalled();
  });
});
