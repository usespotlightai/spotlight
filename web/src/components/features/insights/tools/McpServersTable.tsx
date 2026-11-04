import { Fragment, type ReactNode } from 'react';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
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
  dismissedToolFilter,
  failedAfterFilter,
  formatLatency,
  OTHER_TOOLS,
  SERVER_HEADINGS,
  type ServerReport,
  serverFailedFilter,
  serverFilter,
  type ToolDismissals,
} from '@/lib/insights-tools';
import { cn } from '@/lib/utils';

const ROW =
  'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 @4xl:grid-cols-subgrid';

const LEAD = 'col-span-full min-w-0 truncate @4xl:col-span-1';

const runsOf = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? 'run' : 'runs'}`;

const toRuns = (shown: ReactNode, filter: InsightsFilter) => (
  <InsightsLink tab="traces" filter={filter}>
    {shown}
  </InsightsLink>
);

const shareOf = (
  rate: number | null,
  count: number,
  runs: number,
  filter: InsightsFilter,
) =>
  count > 0 ? (
    <WithTooltip tooltip={`${formatCount(count)} of ${runsOf(runs)}`}>
      <span>{toRuns(formatShare(rate), filter)}</span>
    </WithTooltip>
  ) : (
    formatShare(rate)
  );

function DismissedToolRow({ dismissed }: { dismissed: ToolDismissals }) {
  return (
    <li
      data-slot="dismissed-tool"
      className={cn(ROW, OUTER_GUIDE, OUTER_DIVIDER)}
    >
      <span className={cn(LEAD, 'text-muted-foreground', OUTER_INDENT)}>
        {dismissed.tool}
      </span>
      {[0, 1, 2, 3, 4, 5].map((at) => (
        <span key={at} aria-hidden className="hidden @4xl:block" />
      ))}
      <NestedCell heading="Dismissed">
        <span className="text-muted-foreground">
          {toRuns(runsOf(dismissed.dismissed), dismissedToolFilter(dismissed))}
        </span>
      </NestedCell>
    </li>
  );
}

type McpServersTableProps = {
  servers: readonly ServerReport[];
  dismissals: readonly ToolDismissals[];
};

export function McpServersTable({ servers, dismissals }: McpServersTableProps) {
  const others = dismissals.filter(
    (each) =>
      each.server === null ||
      !servers.some((server) => server.server === each.server),
  );

  return (
    <NestedTable label="How each MCP server behaved" headings={SERVER_HEADINGS}>
      {servers.map((server) => {
        const runs = serverFilter(server.server);

        return (
          <Fragment key={server.server}>
            <li data-slot="mcp-server" className={cn(ROW, ROW_DIVIDER)}>
              <span className={cn(LEAD, 'text-foreground', EDGE_INDENT)}>
                {server.server}
              </span>
              <NestedCell heading="Runs">
                {toRuns(formatCount(server.runs), runs)}
              </NestedCell>
              <NestedCell heading="Calls per run">
                {toRuns(formatPer(server.callsPerRun), runs)}
              </NestedCell>
              <NestedCell heading="Median call">
                {formatLatency(server.p50Ms)}
              </NestedCell>
              <NestedCell heading="Slowest 5%">
                {formatLatency(server.p95Ms)}
              </NestedCell>
              <NestedCell heading="Error rate">
                {server.failedCalls > 0 ? (
                  <WithTooltip
                    tooltip={`${formatCount(server.failedCalls)} of ${formatCount(server.calls)} calls failed`}
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
                {shareOf(
                  server.failingRunRate,
                  server.failingRuns,
                  server.runs,
                  failedAfterFilter(server.server),
                )}
              </NestedCell>
              <NestedCell heading="Dismissed">
                {shareOf(
                  server.dismissedRate,
                  server.dismissed,
                  server.runs,
                  dismissedServerFilter(server.server),
                )}
              </NestedCell>
            </li>
            {dismissals
              .filter((each) => each.server === server.server)
              .map((each) => (
                <DismissedToolRow key={each.tool} dismissed={each} />
              ))}
          </Fragment>
        );
      })}
      {others.length > 0 && (
        <>
          <li data-slot="mcp-server" className={cn(ROW, ROW_DIVIDER)}>
            <span className={cn(LEAD, 'text-foreground', EDGE_INDENT)}>
              {OTHER_TOOLS}
            </span>
          </li>
          {others.map((each) => (
            <DismissedToolRow
              key={`${each.server ?? ''}/${each.tool}`}
              dismissed={each}
            />
          ))}
        </>
      )}
    </NestedTable>
  );
}
