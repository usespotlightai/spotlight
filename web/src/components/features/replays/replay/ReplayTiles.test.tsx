import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReplayTiles } from '@/components/features/replays/replay/ReplayTiles';
import type { ReplayDetail } from '@/lib/replay';

const detail = (over: Partial<ReplayDetail>): ReplayDetail =>
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
    judges: false,
    checks: true,
    repeats: 1,
    ceiling: { amount: 10, currency: 'USD' },
    totals: {
      successRate: 0.75,
      interval: null,
      scored: 4,
      unscored: 0,
      spent: { amount: 2, currency: 'USD' },
      spentElsewhere: [],
      unpriced: 0,
      unpricedCalls: 0,
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
    baselineReplayId: 'baseline',
    pairwiseReference: null,
    referencePairs: null,
    entries: [],
    ...over,
  }) as ReplayDetail;

const gainTile = () =>
  screen.getByText('Gain').closest('[data-slot="insights-tile"]');

describe('ReplayTiles', () => {
  it('shows the gain beside the baseline’s success rate', () => {
    render(<ReplayTiles replay={detail({})} />);

    expect(gainTile()).toHaveTextContent('+25 pts');
    expect(gainTile()).toHaveTextContent('Better · baseline 50%');
  });

  it('shows the gain of a replay with the answer beside the live replay’s success rate', () => {
    render(
      <ReplayTiles
        replay={detail({
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
        })}
      />,
    );

    expect(gainTile()).toHaveTextContent('Better · live config 25%');
    expect(gainTile()).not.toHaveTextContent('baseline');
  });

  it('shows no rate for a reference that has scored nothing yet', () => {
    render(
      <ReplayTiles
        replay={detail({
          referenceReplay: {
            replayId: 'baseline',
            successRate: null,
            interval: null,
          },
        })}
      />,
    );

    expect(gainTile()).not.toHaveTextContent('%');
  });
});
