import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { InboxWorking } from '@/components/features/inbox/conversation/InboxWorking';
import type { RunWaiting } from '@/lib/run-waiting';

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: { role: 'member' } }),
}));

const OFFLINE: RunWaiting = {
  reason: 'hosts-offline',
  since: '2026-09-14T08:31:00.000Z',
  quiet: { hosts: ['dev-host'], since: '2026-09-14T08:30:00.000Z' },
};

const working = (
  progress: 'queued' | 'in-progress',
  waiting: RunWaiting | null,
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
              waiting={waiting}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('InboxWorking', () => {
  it('says a queued run waits for its offline host', () => {
    working('queued', OFFLINE);

    expect(
      screen.getByText(
        /^Queued: dev-host, the only host that can take this run, has been offline since .+ Ask an admin to start it\.$/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/when a runner is free/)).not.toBeInTheDocument();
  });

  it('says no host is online when none is left that could take the run', () => {
    working('queued', { ...OFFLINE, quiet: { hosts: [], since: null } });

    expect(
      screen.getByText(
        'Queued: no host that can take this run is online. Ask an admin to add one.',
      ),
    ).toBeInTheDocument();
  });

  it('waits for a free runner while the hosts are only busy', () => {
    working('queued', {
      reason: 'hosts-pull',
      since: OFFLINE.since,
      quiet: null,
    });

    expect(
      screen.getByText('Queued. Triage starts when a runner is free.'),
    ).toBeInTheDocument();
  });

  it('says nothing of the hosts once the run is under way', () => {
    working('in-progress', OFFLINE);

    expect(screen.getByText('Triage is working…')).toBeInTheDocument();
  });
});
