import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { McpServersTable } from '@/components/features/insights/tools/McpServersTable';
import type { ServerReport } from '@/lib/insights-tools';
import { SERVERS_NOTE } from '@/lib/insights-tools';

export function McpServers({ servers }: { servers: readonly ServerReport[] }) {
  return (
    <InsightsCard
      tableOnly={servers.length > 0}
      scrolls
      title="MCP servers"
      description={SERVERS_NOTE}
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
