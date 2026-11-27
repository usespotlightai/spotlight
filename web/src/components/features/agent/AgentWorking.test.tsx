import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentWorking } from '@/components/features/agent/AgentWorking';
import { formatDate } from '@/lib/date-format';
import type { JournalStep } from '@/lib/inbox';
import type { RunWaiting } from '@/lib/run-waiting';

const fleet = vi.hoisted(() => ({ readyToRun: true }));
const workspace = vi.hoisted(() => ({ role: 'member' }));

vi.mock('@/hooks/api/useRunners', () => ({
  useRunners: () => ({ data: { hosts: [], pools: [], ...fleet } }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: workspace }),
}));

const START = Date.parse('2026-09-14T09:00:00.000Z');

const running: JournalStep = {
  kind: 'tool',
  text: 'npm test',
  status: 'pending',
  tool: 'execute',
  detail: null,
  ms: 0,
  startedAt: '2026-09-14T09:00:00.000Z',
  locations: [],
  input: null,
  output: null,
  change: null,
};

describe('AgentWorking', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
    fleet.readyToRun = true;
    workspace.role = 'member';
  });

  it('prepares the workspace before the agent takes a step', () => {
    render(
      <AgentWorking
        slug="acme"
        harness="claude-code"
        waiting={null}
        progress="in-progress"
        phase={{ kind: 'preparing', key: 'run_1:preparing', since: null }}
      />,
    );

    expect(screen.getByText('Preparing the workspace…')).toBeInTheDocument();
  });

  it('names the running step and counts its time once it runs long', () => {
    render(
      <AgentWorking
        slug="acme"
        harness="claude-code"
        waiting={null}
        progress="in-progress"
        phase={{ kind: 'step', step: running, key: 'run_1:step', since: START }}
      />,
    );

    expect(screen.getByText('Running npm test…')).toBeInTheDocument();
    expect(screen.queryByText('4s')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.queryByText('4s')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(63_000);
    });
    expect(screen.getByText('1m 7s')).toBeInTheDocument();
  });

  it('counts again from zero when the next step starts', () => {
    const { rerender } = render(
      <AgentWorking
        slug="acme"
        harness="claude-code"
        waiting={null}
        progress="in-progress"
        phase={{ kind: 'step', step: running, key: 'run_1:step', since: START }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.getByText('9s')).toBeInTheDocument();

    rerender(
      <AgentWorking
        slug="acme"
        harness="claude-code"
        waiting={null}
        progress="in-progress"
        phase={{ kind: 'working', key: 'run_1:working:2', since: null }}
      />,
    );

    expect(screen.getByText('The agent is working…')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+s$/)).not.toBeInTheDocument();
  });

  it('counts from when the step started, so a reload keeps the count', () => {
    vi.setSystemTime(START + 75_000);
    render(
      <AgentWorking
        slug="acme"
        harness="claude-code"
        waiting={null}
        progress="in-progress"
        phase={{ kind: 'step', step: running, key: 'run_1:step', since: START }}
      />,
    );

    expect(screen.getByText('1m 15s')).toBeInTheDocument();
  });

  it('counts from now when the step seems to start later than now', () => {
    render(
      <AgentWorking
        slug="acme"
        harness="claude-code"
        waiting={null}
        progress="in-progress"
        phase={{
          kind: 'step',
          step: running,
          key: 'run_1:step',
          since: START + 60_000,
        }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.getByText('6s')).toBeInTheDocument();
  });

  it('keeps the queued words while the run waits for a runner', () => {
    render(
      <AgentWorking
        slug="acme"
        harness="claude-code"
        waiting={null}
        progress="queued"
        phase={{ kind: 'step', step: running, key: 'run_1:step', since: START }}
      />,
    );

    expect(
      screen.getByText('Queued. The agent starts when a runner is free.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Running npm test…')).not.toBeInTheDocument();
  });

  it('says no host serves the workspace and links an admin to adding one', () => {
    fleet.readyToRun = false;
    workspace.role = 'admin';

    render(
      <MemoryRouter>
        <AgentWorking
          slug="acme"
          harness="claude-code"
          waiting={null}
          progress="queued"
          phase={{ kind: 'working', key: 'run_1:working', since: null }}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Queued\. No host serves this workspace\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a host' })).toHaveAttribute(
      'href',
      '/w/acme/settings/runners/new',
    );
    expect(screen.queryByText(/when a runner is free/)).not.toBeInTheDocument();
  });

  it('asks a member to have an admin add a host', () => {
    fleet.readyToRun = false;

    render(
      <AgentWorking
        slug="acme"
        harness="claude-code"
        waiting={null}
        progress="queued"
        phase={{ kind: 'working', key: 'run_1:working', since: null }}
      />,
    );

    expect(
      screen.getByText(
        'Queued. No host serves this workspace. Ask an admin to add one.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  describe('while the hosts that can take its run are offline', () => {
    const OFFLINE_SINCE = '2026-09-14T08:30:00.000Z';
    const at = formatDate(new Date(OFFLINE_SINCE), {
      hour: '2-digit',
      minute: '2-digit',
    });
    const offline = (hosts: string[]): RunWaiting => ({
      reason: 'hosts-offline',
      since: OFFLINE_SINCE,
      quiet: { hosts, since: OFFLINE_SINCE },
    });

    const queued = (waiting: RunWaiting | null) =>
      render(
        <MemoryRouter>
          <AgentWorking
            slug="acme"
            harness="claude-code"
            waiting={waiting}
            progress="queued"
            phase={{ kind: 'working', key: 'run_1:working', since: null }}
          />
        </MemoryRouter>,
      );

    it('names the offline host, and links an admin to adding another', () => {
      workspace.role = 'admin';
      queued(offline(['dev-host']));

      expect(
        screen.getByText(
          `Queued: dev-host, the only host that can take this chat, has been offline since ${at}.`,
          { exact: false },
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'add another host' }),
      ).toHaveAttribute('href', '/w/acme/settings/runners/new');
      expect(
        screen.queryByText(/when a runner is free/),
      ).not.toBeInTheDocument();
    });

    it('asks a member to have an admin start the host', () => {
      queued(offline(['dev-host']));

      expect(
        screen.getByText(/Ask an admin to start it\.$/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('counts several offline hosts', () => {
      queued(offline(['dev-host', 'ci-host']));

      expect(
        screen.getByText(
          /^Queued: the 2 hosts that can take this chat have been offline since .+ Ask an admin to start one\.$/,
        ),
      ).toBeInTheDocument();
    });

    it('waits for a free runner while its hosts are only busy', () => {
      queued({ reason: 'hosts-pull', since: OFFLINE_SINCE, quiet: null });

      expect(
        screen.getByText('Queued. The agent starts when a runner is free.'),
      ).toBeInTheDocument();
    });
  });
});
