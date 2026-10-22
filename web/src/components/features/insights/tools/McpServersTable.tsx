import type { ReactNode } from 'react';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  formatCount,
  formatPer,
  formatShare,
  type InsightsFilter,
} from '@/lib/insights';
import {
  dismissedServerFilter,
  failedAfterFilter,
  formatLatency,
  SERVER_HEADINGS,
  type ServerReport,
  serverFailedFilter,
  serverFilter,
} from '@/lib/insights-tools';
import { cn } from '@/lib/utils';

const toRuns = (shown: ReactNode, filter: InsightsFilter) => (
  <InsightsLink tab="traces" filter={filter}>
    {shown}
  </InsightsLink>
);

export function McpServersTable({
  servers,
}: {
  servers: readonly ServerReport[];
}) {
  return (
    <NestedTable label="How each MCP server behaved" headings={SERVER_HEADINGS}>
      {servers.map((server) => {
        const runs = serverFilter(server.server);

        return (
          <li
            key={server.server}
            data-slot="mcp-server"
            className={cn(
              'col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid',
              ROW_DIVIDER,
            )}
          >
            <span
              className={cn(
                'col-span-full min-w-0 truncate font-medium text-foreground text-xs @4xl:col-span-1',
                EDGE_INDENT,
              )}
            >
              {server.server}
            </span>
            <NestedCell heading="Runs" strong>
              {toRuns(formatCount(server.runs), runs)}
            </NestedCell>
            <NestedCell heading="Calls per run">
              {toRuns(formatPer(server.callsPerRun), runs)}
            </NestedCell>
            <NestedCell heading="p50">
              {toRuns(formatLatency(server.p50Ms), runs)}
            </NestedCell>
            <NestedCell heading="p95">
              {toRuns(formatLatency(server.p95Ms), runs)}
            </NestedCell>
            <NestedCell heading="Error rate" strong>
              {server.failedCalls > 0 ? (
                <WithTooltip
                  tooltip={`${server.failedCalls} of ${server.calls} calls, unfinished included`}
                >
                  <span>
                    {toRuns(
                      formatShare(server.errorRate),
                      serverFailedFilter(server.server),
                    )}
                  </span>
                </WithTooltip>
              ) : (
                formatShare(server.errorRate)
              )}
            </NestedCell>
            <NestedCell heading="Failing runs">
              {server.failingRuns > 0
                ? toRuns(
                    formatCount(server.failingRuns),
                    failedAfterFilter(server.server),
                  )
                : formatCount(0)}
            </NestedCell>
            <NestedCell heading="Dismissed">
              {server.dismissed > 0
                ? toRuns(
                    formatCount(server.dismissed),
                    dismissedServerFilter(server.server),
                  )
                : formatCount(0)}
            </NestedCell>
          </li>
        );
      })}
    </NestedTable>
  );
}
