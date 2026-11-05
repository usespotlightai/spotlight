import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  OutputAgainstCost,
  TipContent,
} from '@/components/features/insights/OutputAgainstCost';
import type { DayOutput } from '@/lib/insights';

const day: DayOutput = {
  day: '2026-09-30',
  runs: 5,
  spend: { amount: 4.2, currency: 'USD' },
  unpriced: 0,
  mixedCurrencies: false,
  merged: 1,
  mergedTaskIds: [],
  changes: [
    {
      lineId: 'line_1',
      stationId: 'station_build',
      fingerprint: 'b7d4a60c8e2f1a9b',
      previousFingerprint: '0'.repeat(64),
      firstRunAt: '2026-09-30T10:00:00.000Z',
      runId: 'run_1',
    },
  ],
};

const meta = {
  title: 'Insights/OutputAgainstCost',
  component: OutputAgainstCost,
} satisfies Meta<typeof OutputAgainstCost>;

export default meta;

export const TooltipOnConfigChangeDay: StoryObj = {
  render: () => (
    <div className="p-4">
      <TipContent
        placement={{ left: false, above: false }}
        active
        payload={[{ payload: day }]}
        currency="USD"
      />
    </div>
  ),
};
