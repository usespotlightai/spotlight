import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GatesChangesToggle } from '@/components/features/replays/set/GatesChangesToggle';
import type { ReplaySet } from '@/lib/replay';

const mutate = vi.fn();
vi.mock('@/hooks/api/useGateChanges', () => ({
  useGateChanges: () => ({ mutate, isPending: false }),
}));

const SET: ReplaySet = {
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  name: 'Queue fixes',
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  gatesChanges: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    oracle: null,
  },
  minGain: 0.05,
  composition: {
    outcomes: [
      { outcome: 'accepted', count: 0 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 0 },
      { outcome: 'other', count: 0 },
    ],
    origins: [],
    oldest: null,
    median: null,
    newest: null,
    balanceWarning: null,
  },
  entries: [],
};

describe('GatesChangesToggle', () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  it('turns gating on for the set', () => {
    render(<GatesChangesToggle teamId="team_1" set={SET} />);

    const toggle = screen.getByRole('switch', {
      name: 'Gates config changes',
    });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    expect(mutate).toHaveBeenCalledWith({
      teamId: 'team_1',
      setId: 'set_1',
      gates: true,
    });
  });

  it('shows a gating set as gating', () => {
    render(
      <GatesChangesToggle
        teamId="team_1"
        set={{ ...SET, gatesChanges: true }}
      />,
    );

    expect(
      screen.getByRole('switch', { name: 'Gates config changes' }),
    ).toBeChecked();
  });
});
