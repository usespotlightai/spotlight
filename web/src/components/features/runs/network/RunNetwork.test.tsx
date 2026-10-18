import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunNetwork } from '@/components/features/runs/network/RunNetwork';
import type { RunNetworkResponseDto } from '@/lib/api';

const network = vi.fn<() => RunNetworkResponseDto | undefined>();
const failing = vi.fn(() => false);

vi.mock('@/hooks/api/useRunNetwork', () => ({
  useRunNetwork: () => ({
    data: network(),
    isPending: network() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const AT = '2026-10-16T12:00:00.000Z';

const connection = (
  host: string,
  outcome: 'passthrough' | 'injected' | 'blocked' | 'failed' = 'passthrough',
  port = 443,
) => ({
  host,
  port,
  bytesOut: 1_024,
  bytesIn: 2_048,
  ms: 5,
  outcome,
  status: null,
  reason: null,
  error: outcome === 'blocked' || outcome === 'failed' ? outcome : null,
  at: AT,
});

const showing = () => render(<RunNetwork teamId="team_1" runId="run_1" />);

beforeEach(() => {
  failing.mockReturnValue(false);
  network.mockReturnValue({
    runId: 'run_1',
    attempt: 1,
    egressEnforcement: 'enforced',
    connections: [
      connection('registry.npmjs.org'),
      connection('registry.npmjs.org'),
      connection('mcp.linear.app', 'injected'),
      connection('paste.example.net', 'blocked'),
      connection('db.internal', 'passthrough', 5432),
    ],
  });
});

describe('RunNetwork', () => {
  it('says egress was enforced and lists each destination once, blocked first', () => {
    showing();

    expect(
      document.querySelector('[data-slot="egress-enforcement"]'),
    ).toHaveTextContent('Enforced');
    expect(screen.getByText('Connections').nextSibling).toHaveTextContent('5');
    const rows = within(
      screen.getByRole('list', { name: 'Destinations' }),
    ).getAllByRole('listitem');
    expect(rows.map((each) => each.dataset.outcome)).toEqual([
      'blocked',
      'passthrough',
      'passthrough',
      'injected',
    ]);
    expect(rows[0]).toHaveTextContent('paste.example.net');
    expect(rows[0]).toHaveTextContent('Blocked');
    expect(rows[1]).toHaveTextContent('registry.npmjs.org');
    expect(rows[1]).toHaveTextContent('6 KB');
    expect(screen.getByText('db.internal:5432')).toBeInTheDocument();
  });

  it('lists a connection egress could not open with the blocked ones', () => {
    network.mockReturnValue({
      runId: 'run_1',
      attempt: 1,
      egressEnforcement: 'enforced',
      connections: [
        connection('registry.npmjs.org'),
        connection('nowhere.example', 'failed'),
      ],
    });

    showing();

    const rows = within(
      screen.getByRole('list', { name: 'Destinations' }),
    ).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('nowhere.example');
    expect(rows[0]).toHaveTextContent('Failed');
  });

  it('shows an injected request that the host did not accept as auth failed', () => {
    network.mockReturnValue({
      runId: 'run_1',
      attempt: 1,
      egressEnforcement: 'enforced',
      connections: [
        connection('registry.npmjs.org'),
        {
          ...connection('mcp.linear.app', 'injected'),
          status: 401,
          error: 'auth-failed',
        },
      ],
    });

    showing();

    const rows = within(
      screen.getByRole('list', { name: 'Destinations' }),
    ).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('mcp.linear.app');
    expect(rows[0]).toHaveTextContent('Auth failed');
  });

  it('says when egress was not enforced', () => {
    network.mockReturnValue({
      runId: 'run_1',
      attempt: 1,
      egressEnforcement: 'not-enforced',
      connections: [],
    });

    showing();

    expect(
      document.querySelector('[data-slot="egress-enforcement"]'),
    ).toHaveTextContent('Not enforced');
    expect(screen.queryByRole('list', { name: 'Destinations' })).toBeNull();
  });

  it('shows nothing for a run that went out without a shared egress', () => {
    network.mockReturnValue({
      runId: 'run_1',
      attempt: 1,
      egressEnforcement: null,
      connections: [],
    });

    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });

  it('says while it loads', () => {
    network.mockReturnValue(undefined);
    showing();
    expect(
      screen.getByRole('status', { name: 'Loading the egress' }),
    ).toBeInTheDocument();
  });
});
