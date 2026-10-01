import type { QueryClient } from '@tanstack/react-query';
import { stationAlertKeys } from '@/hooks/api/useStationAlert';
import type { StationAlertCrossing } from '@/lib/station-alert';
import { failQuery } from '@/stories/failQuery';
import { daysAgo, LINE_ID, loadInsights } from '@/stories/fixtures/insights';
import { SLUG, TEAM_ID } from '@/stories/fixtures/team';

export { SLUG, TEAM_ID };

export const ALERT_ID = 'alert_sent_back';

export const ALERT_ITEM_ID = 'aside_sent_back_alert';

const SHARES = [
  0.2, 0.2, 0.1, 0.2, 0.3, 0.2, 0.2, 0.3, 0.3, 0.4, 0.5, 0.5, 0.6, 0.5, 0.6,
];

const CROSSED: StationAlertCrossing = {
  alertId: ALERT_ID,
  lineId: LINE_ID,
  stationId: 'station_implementation',
  threshold: {
    measure: 'sent_back_rate',
    risesBy: 0.15,
    fallsBy: null,
    above: null,
    below: null,
    over: 5,
  },
  value: 0.5,
  baseline: 0.2,
  runId: 'run_impl_11',
  taskId: 'task_retries',
  raisedAt: daysAgo(1, 14),
  recoveredAt: null,
  currency: 'USD',
  series: SHARES.map((value, at) => ({
    runId: `run_impl_${at + 1}`,
    endedAt: daysAgo(3 - at / 7),
    value: at < 4 ? null : value,
  })),
};

const keyOf = stationAlertKeys.of(TEAM_ID, ALERT_ID);

export const seedAlert = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(keyOf, CROSSED);
};

export const seedRecoveredAlert = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(keyOf, { ...CROSSED, recoveredAt: daysAgo(0, 9) });
};

export const seedUnchartedAlert = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(keyOf, { ...CROSSED, series: [] });
};

export const failAlert = (client: QueryClient) => {
  loadInsights(client);
  failQuery(client, keyOf);
};
