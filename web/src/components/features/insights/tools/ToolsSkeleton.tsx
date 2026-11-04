import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import {
  MIN_READ_SHARE,
  SERVER_HEADINGS,
  SERVERS_NOTE,
  SKILLS_NOTE,
  skillHeadings,
} from '@/lib/insights-tools';

export function ToolsSkeleton() {
  return (
    <div role="status" aria-label="Loading the tools" className="contents">
      <InsightsSection title="Skills" tooltip={SKILLS_NOTE}>
        <NestedTableSkeleton
          label="Loading the skills"
          headings={skillHeadings(null, MIN_READ_SHARE)}
          rows={6}
          rowClassName="py-2"
        />
      </InsightsSection>

      <InsightsSection title="MCP servers" tooltip={SERVERS_NOTE}>
        <NestedTableSkeleton
          label="Loading the MCP servers"
          headings={SERVER_HEADINGS}
          rows={3}
          rowClassName="py-2"
        />
      </InsightsSection>
    </div>
  );
}
