import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InboxWorking } from '@/components/features/inbox/conversation/InboxWorking';
import type { OfflineHarness } from '@/lib/runner';

const fleet = vi.hoisted(() => ({
  readyToRun: true,
  offlineHarnesses: [] as OfflineHarness[],
}));
const asked = vi.hoisted(() => ({ slugs: [] as (string | undefined)[] }));

vi.mock('@/hooks/api/useRunners', () => ({
  useRunners: (slug: string | undefined) => {
    asked.slugs.push(slug);
    return {
      data: slug === undefined ? undefined : { hosts: [], pools: [], ...fleet },
    };
  },
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: { role: 'member' } }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [{ id: 'claude-code', name: 'Claude Code' }],
  }),
}));

const OFFLINE: OfflineHarness = {
  harness: 'claude-code',
  hosts: [{ id: 'host_1', name: 'dev-host' }],
  since: '2026-09-14T08:30:00.000Z',
};

const working = (
  progress: 'queued' | 'in-progress',
  harness: string | undefined,
) =>
  render(
    <MemoryRouter initialEntries={['/w/acme/inbox/item_1']}>
      <Routes>
        <Route
          path="/w/:slug/inbox/:itemId"
          element={
            <InboxWorking
              station="Triage"
              stationColor="blue"
              stationPosition={0}
              stationCount={3}
              progress={progress}
              harness={harness}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('InboxWorking', () => {
  afterEach(() => {
    fleet.offlineHarnesses = [];
    asked.slugs = [];
  });

  it('says a queued run waits for its offline host', () => {
    fleet.offlineHarnesses = [OFFLINE];
    working('queued', 'claude-code');

    expect(
      screen.getByText(
        /^Queued: dev-host, the only host that runs Claude Code here, has been offline since .+ Ask an admin to start it\.$/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/when a runner is free/)).not.toBeInTheDocument();
  });

  it('waits for a free runner while a host of its harness is online', () => {
    working('queued', 'claude-code');

    expect(
      screen.getByText('Queued. Triage starts when a runner is free.'),
    ).toBeInTheDocument();
  });

  it('asks for no runners once the run is under way', () => {
    fleet.offlineHarnesses = [OFFLINE];
    working('in-progress', 'claude-code');

    expect(screen.getByText('Triage is working…')).toBeInTheDocument();
    expect(asked.slugs.every((each) => each === undefined)).toBe(true);
  });
});
