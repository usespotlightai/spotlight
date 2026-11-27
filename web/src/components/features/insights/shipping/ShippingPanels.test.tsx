import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShippingPanels } from '@/components/features/insights/shipping/ShippingPanels';
import type {
  InsightsShippingResponseDto,
  PercentilesResponseDto,
} from '@/lib/api';
import { stationNamesOf } from '@/lib/insights';
import { shippingOf } from '@/lib/insights-shipping';

const HOUR = 3_600_000;

const measured = (count: number): PercentilesResponseDto => ({
  p50Ms: count > 0 ? HOUR : null,
  p75Ms: count > 0 ? HOUR : null,
  p90Ms: count > 0 ? HOUR : null,
  p95Ms: count > 0 ? HOUR : null,
  count,
});

const SHIPPED: InsightsShippingResponseDto = {
  shippedAny: true,
  period: {
    name: '7d',
    from: '2026-11-19T00:00:00.000Z',
    to: '2026-11-26T00:00:00.000Z',
    previousFrom: '2026-11-12T00:00:00.000Z',
    previousTo: '2026-11-19T00:00:00.000Z',
    days: [],
  },
  toMerge: { spotlight: measured(13), people: measured(5) },
  toMergeChanges: {
    spotlight: { p50: null, p75: null, p90: null, p95: null },
    people: { p50: null, p75: null, p90: null, p95: null },
  },
  mergeDays: [],
  types: [
    {
      type: 'feature',
      merged: 14,
      toMerge: { spotlight: measured(11), people: measured(3) },
    },
  ],
  slowestFirst: {
    p50: ['feature'],
    p75: ['feature'],
    p90: ['feature'],
    p95: ['feature'],
  },
  depth: [
    {
      week: '2026-11-23',
      merged: 18,
      rounds: [{ rounds: '0', merged: 18, rate: 1 }],
    },
  ],
  depthTotals: [{ rounds: '0', merged: 18, rate: 1 }],
  reviewDays: [],
  bots: [],
  pipeline: {
    merged: 13,
    types: [{ type: 'feature', merged: 13 }],
    layouts: { stations: [], stages: [] },
  },
};

const showing = () =>
  render(<ShippingPanels shipping={shippingOf(SHIPPED, stationNamesOf([]))} />);

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

const card = (title: string) =>
  screen.getByRole('region', { name: new RegExp(`^${title}`) });

describe('ShippingPanels', () => {
  it('says the pipeline counts Spotlight’s pull requests', () => {
    showing();

    expect(
      within(card('Flow through the pipeline')).getByText(
        '13 Spotlight PRs merged',
      ),
    ).toBeInTheDocument();
  });

  it('splits each type’s merges into Spotlight’s and people’s', () => {
    showing();

    expect(
      within(card('Time to merge by PR type')).getByText(
        '11 by Spotlight, 3 by people',
      ),
    ).toBeInTheDocument();
  });

  it('says review depth counts people’s pull requests too', () => {
    showing();

    expect(
      within(card('Review depth by week')).getByText(
        'Spotlight’s and people’s PRs',
      ),
    ).toBeInTheDocument();
  });
});
