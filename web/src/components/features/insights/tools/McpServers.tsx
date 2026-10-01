import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { McpServersTable } from '@/components/features/insights/tools/McpServersTable';
import type { ServerReport } from '@/lib/insights-tools';

export function McpServers({ servers }: { servers: readonly ServerReport[] }) {
  return (
    <InsightsCard
      title="MCP servers"
      description="How each MCP server the runs called behaved. Calls that never finished count as failed; calls a person refused are left out, and Refused counts the runs they were refused in. A failing run is one that failed where the run’s last call to the server failed."
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
