import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamMemory } from '@/components/features/memory/TeamMemory';
import type { TeamMemory as Memory, MemoryFilter } from '@/lib/memory';

const refetch = vi.fn();
const asked: MemoryFilter[] = [];
const memoriesState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch,
};

vi.mock('@/hooks/api/useTeamMemories', () => ({
  useTeamMemories: (_teamId: string, filter: MemoryFilter) => {
    asked.push(filter);
    return memoriesState;
  },
}));
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [
      {
        id: 'line_delivery',
        key: 'delivery',
        name: 'Delivery',
        stations: [
          { id: 'station_build', name: 'Implementation', kind: 'work' },
        ],
        reactions: [],
        repositories: ['acme/api'],
      },
    ],
  }),
}));
vi.mock('@/components/features/memory/WriteMemoryButton', () => ({
  WriteMemoryButton: () => <button type="button">Write a memory</button>,
}));
vi.mock('@/components/features/memory/MemoryDetails', () => ({
  MemoryDetails: ({ memoryId }: { memoryId: string }) => (
    <p>Details of {memoryId}</p>
  ),
}));

const memory = (over: Partial<Memory> = {}): Memory => ({
  id: 'memory_1',
  handle: 'M-1',
  kind: 'preference',
  body: 'Name branches after the ticket.',
  source: 'person',
  standing: 'stands',
  reach: 'team',
  lineId: null,
  stationId: null,
  repository: null,
  paths: [],
  approvedBy: { id: 'user_2', name: 'Maya Chen' },
  approvedAt: '2026-09-27T10:00:00.000Z',
  supersedes: null,
  retirement: null,
  grounds: null,
  ...over,
});

function Where() {
  const location = useLocation();
  return <output aria-label="Where">{location.search}</output>;
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
  asked.length = 0;
  memoriesState.data = undefined;
  memoriesState.isPending = false;
  memoriesState.errorUpdateCount = 0;
});

describe('TeamMemory', () => {
  it('lists every standing memory, saying where it applies and who kept it', () => {
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

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('The whole team')).toBeVisible();
    expect(
      screen.getByText('Delivery › Implementation · acme/api: src/uploads.ts'),
    ).toBeVisible();
    expect(screen.getAllByText(/kept by Maya Chen/)).toHaveLength(2);
    expect(asked[0]?.standing).toBe('stands');
  });

  it('asks for the retired memories, and says why each was retired', () => {
    memoriesState.data = [
      memory({
        standing: 'retired',
        retirement: {
          at: '2026-09-27T11:00:00.000Z',
          by: { id: 'user_2', name: 'Maya Chen' },
          reason: 'It was fixed.',
          supersededBy: null,
        },
      }),
    ];

    showing('/w/acme/team/team_1/memory?standing=retired');

    expect(asked[0]?.standing).toBe('retired');
    expect(
      screen.getByText('Retired by Maya Chen: It was fixed.'),
    ).toBeVisible();
  });

  it('narrows the list by what is chosen, kept in the address', async () => {
    memoriesState.data = [memory()];
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Retired' }));

    expect(screen.getByRole('status', { name: 'Where' })).toHaveTextContent(
      '?standing=retired',
    );
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

    expect(screen.getByText('Nothing remembered yet')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Write a memory' }),
    ).toBeVisible();
  });

  it('still offers the retired memories when none stands', async () => {
    memoriesState.data = [];
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Retired' }));

    expect(screen.getByRole('status', { name: 'Where' })).toHaveTextContent(
      '?standing=retired',
    );
  });

  it('narrows the list to a kind', async () => {
    memoriesState.data = [memory()];
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Kind: Every kind' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Failure' }),
    );

    expect(screen.getByRole('status', { name: 'Where' })).toHaveTextContent(
      '?kind=failure',
    );
  });

  it('says nothing matches rather than inviting a first memory when filtered', () => {
    memoriesState.data = [];
    showing('/w/acme/team/team_1/memory?kind=failure');

    expect(screen.getByText('No memories match.')).toBeVisible();
  });

  it('holds its shape while it loads', () => {
    memoriesState.isPending = true;
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the team’s memory' }),
    ).toBeInTheDocument();
  });

  it('keeps the filters when the memory could not be loaded', () => {
    memoriesState.errorUpdateCount = 1;
    showing('/w/acme/team/team_1/memory?path=.');

    expect(screen.getByRole('textbox', { name: 'Path' })).toHaveValue('.');
    expect(screen.getByRole('alert')).toBeVisible();
  });

  it('offers to try again when the memory could not be loaded', async () => {
    memoriesState.errorUpdateCount = 1;
    showing();

    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));

    expect(refetch).toHaveBeenCalled();
  });
});
