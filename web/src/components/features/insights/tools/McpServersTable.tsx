import type { ReactNode } from 'react';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import {
  countShown,
  type InsightsFilter,
  perShown,
  shareShown,
} from '@/lib/insights';
import {
  failedAfterFilter,
  latencyShown,
  refusedServerFilter,
  type ServerReport,
  serverFailedFilter,
  serverFilter,
} from '@/lib/insights-tools';

const toRuns = (shown: ReactNode, filter: InsightsFilter) => (
  <InsightsLink tab="runs" filter={filter}>
    {shown}
  </InsightsLink>
);

export function McpServersTable({
  servers,
}: {
  servers: readonly ServerReport[];
}) {
  const columns: InsightsColumn<ServerReport>[] = [
    {
      id: 'server',
      header: 'Server',
      cell: (server) => <span className="font-mono">{server.server}</span>,
    },
    {
      id: 'runs',
      header: 'Runs',
      numeric: true,
      cell: (server) =>
        toRuns(countShown(server.runs), serverFilter(server.server)),
    },
    {
      id: 'calls-per-run',
      header: 'Calls per run',
      numeric: true,
      cell: (server) =>
        toRuns(perShown(server.callsPerRun), serverFilter(server.server)),
    },
    {
      id: 'p50',
      header: 'p50',
      numeric: true,
      cell: (server) =>
        toRuns(latencyShown(server.p50Ms), serverFilter(server.server)),
    },
    {
      id: 'p95',
      header: 'p95',
      numeric: true,
      cell: (server) =>
        toRuns(latencyShown(server.p95Ms), serverFilter(server.server)),
    },
    {
      id: 'error-rate',
      header: 'Error rate',
      numeric: true,
      cell: (server) =>
        server.failedCalls > 0
          ? toRuns(
              <span
                title={`${server.failedCalls} of ${server.calls} calls, counting calls that never finished`}
              >
                {shareShown(server.errorRate)}
              </span>,
              serverFailedFilter(server.server),
            )
          : shareShown(server.errorRate),
    },
    {
      id: 'failing-runs',
      header: 'Failing runs',
      numeric: true,
      cell: (server) =>
        server.failingRuns > 0
          ? toRuns(
              <span
                title={`Runs that failed where the run’s last call to ${server.server} failed`}
              >
                {countShown(server.failingRuns)}
              </span>,
              failedAfterFilter(server.server),
            )
          : countShown(0),
    },
    {
      id: 'refused',
      header: 'Refused',
      numeric: true,
      cell: (server) =>
        server.refused > 0
          ? toRuns(
              countShown(server.refused),
              refusedServerFilter(server.server),
            )
          : countShown(0),
    },
  ];

  return (
    <InsightsTable
      label="How each MCP server behaved"
      columns={columns}
      rows={servers}
      rowKey={(server) => server.server}
    />
  );
}
