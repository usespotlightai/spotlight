import { EmptyFrame } from '@/components/shared/EmptyFrame';
import { EmptyState } from '@/components/shared/EmptyState';
import { McpLogo } from '@/components/shared/icons';

export function NoMcpServers() {
  return (
    <EmptyFrame className="py-6">
      <EmptyState icon={McpLogo} title="No MCP servers called">
        MCP server calls show here once a run uses one in this period.
      </EmptyState>
    </EmptyFrame>
  );
}
