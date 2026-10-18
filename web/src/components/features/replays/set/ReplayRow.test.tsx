import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ReplayRow } from '@/components/features/replays/set/ReplayRow';
import type { Replay } from '@/lib/replay';

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const replay = (over: Partial<Replay>): Replay =>
  ({
    id: 'replay_1',
    candidate: {
      id: 'c',
      name: 'Shorter prompt',
      kind: 'proposed',
      fingerprint: 'f',
      station: {},
      createdAt: '2026-10-01T09:00:00.000Z',
    },
    isBaseline: false,
    state: 'finished',
    repeats: 1,
    startedAt: '2026-10-02T09:00:00.000Z',
    ceiling: { amount: 10, currency: 'USD' },
    totals: {
      successRate: 0.75,
      interval: null,
      unscored: 0,
      spent: { amount: 2, currency: 'USD' },
    },
    gainOverReference: {
      gain: 0.25,
      low: 0.05,
      high: 0.45,
      significance: 'better',
      minGain: 0.05,
      tasks: 4,
    },
    referenceReplay: { replayId: 'baseline', successRate: 0.5, interval: null },
    pairwiseReference: null,
    referencePairs: null,
    ...over,
  }) as Replay;

const renderRow = (shown: Replay) =>
  render(
    <MemoryRouter>
      <ul>
        <ReplayRow at={AT} replay={shown} baselineId="baseline" />
      </ul>
    </MemoryRouter>,
  );

describe('ReplayRow', () => {
  it('notes the baseline’s success rate beside the gain', () => {
    renderRow(replay({}));

    expect(screen.getByText('+25 pts')).toHaveAccessibleDescription(
      expect.stringContaining('Baseline: 50%'),
    );
  });

  it('notes the live replay’s success rate beside the gain of a replay with the answer', () => {
    renderRow(
      replay({
        candidate: {
          id: 'c',
          name: 'With the answer',
          kind: 'oracle',
          fingerprint: 'f',
          station: {},
          createdAt: '2026-10-01T09:00:00.000Z',
        },
        referenceReplay: {
          replayId: 'live',
          successRate: 0.25,
          interval: null,
        },
      }),
    );

    const gain = screen.getByText('+25 pts');

    expect(gain).toHaveAccessibleDescription(
      expect.stringContaining('Live config: 25%'),
    );
    expect(gain).not.toHaveAccessibleDescription(
      expect.stringContaining('Baseline'),
    );
  });

  it('labels the baseline itself in place of a gain', () => {
    renderRow(
      replay({
        id: 'baseline',
        isBaseline: true,
        gainOverReference: null,
        referenceReplay: null,
      }),
    );

    expect(screen.getByText('Baseline')).toBeInTheDocument();
  });
});
