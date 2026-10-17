import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import {
  SERVER_HEADINGS,
  SERVERS_NOTE,
  SKILLS_NOTE,
  skillHeadings,
} from '@/lib/insights-tools';

export function ToolsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the tools"
      className="flex flex-col gap-3"
    >
      <InsightsCardSkeleton tableOnly title="Skills" description={SKILLS_NOTE}>
        <NestedTableSkeleton
          label="Loading the skills"
          headings={skillHeadings(null)}
          rows={6}
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>

      <InsightsCardSkeleton
        tableOnly
        title="MCP servers"
        description={SERVERS_NOTE}
      >
        <NestedTableSkeleton
          label="Loading the MCP servers"
          headings={SERVER_HEADINGS}
          rows={3}
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>
    </div>
  );
}
