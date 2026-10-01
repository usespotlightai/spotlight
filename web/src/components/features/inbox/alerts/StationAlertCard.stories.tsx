import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { StationAlertCard } from '@/components/features/inbox/alerts/StationAlertCard';
import {
  ALERT_ID,
  ALERT_ITEM_ID,
  failAlert,
  SLUG,
  seedAlert,
  seedRecoveredAlert,
  seedUnchartedAlert,
  TEAM_ID,
} from '@/stories/fixtures/alerts';
import { loadInsights } from '@/stories/fixtures/insights';
import { StoryShell } from '@/stories/StoryShell';

function Showing({ seed }: { seed?: (client: QueryClient) => void }) {
  return (
    <StoryShell at={`/w/${SLUG}/inbox/${ALERT_ITEM_ID}`} seed={seed}>
      <Route
        path="/w/:slug/inbox/:itemId"
        element={
          <div className="mx-auto max-w-3xl p-6">
            <StationAlertCard slug={SLUG} teamId={TEAM_ID} alertId={ALERT_ID} />
          </div>
        }
      />
    </StoryShell>
  );
}

const meta = {
  title: 'Inbox/Alerts',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <Showing seed={loadInsights} />,
};

export const Empty: Story = {
  name: 'Nothing to chart',
  render: () => <Showing seed={seedUnchartedAlert} />,
};

export const Failed: Story = {
  name: 'Error',
  render: () => <Showing seed={failAlert} />,
};

export const WithData: Story = {
  render: () => <Showing seed={seedAlert} />,
};

export const Recovered: Story = {
  render: () => <Showing seed={seedRecoveredAlert} />,
};
