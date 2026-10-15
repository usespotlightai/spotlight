import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { McpServersTable } from '@/components/features/insights/tools/McpServersTable';
import type { ServerReport } from '@/lib/insights-tools';

export function McpServers({ servers }: { servers: readonly ServerReport[] }) {
  return (
    <InsightsCard
      tableOnly={servers.length > 0}
      title="MCP servers"
      description="MCP servers that runs called. Unfinished calls count as failed. Refused calls don’t count. Refused: runs with a refused call. Failing runs: failed runs whose last call to the server failed"
    >
      {servers.length > 0 ? (
        <McpServersTable servers={servers} />
      ) : (
        <p className="text-muted-foreground text-xs">
          No run called an MCP server in this period.
        </p>
      )}
    </InsightsCard>
  );
}
