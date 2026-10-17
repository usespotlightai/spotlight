import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { MemorySkeleton } from '@/components/features/insights/memory/MemorySkeleton';
import { ToolsSkeleton } from '@/components/features/insights/tools/ToolsSkeleton';

export function ToolsAndSkillsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <InsightsSection title="Skills and tools">
        <ToolsSkeleton />
      </InsightsSection>

      <InsightsSection title="Memory">
        <MemorySkeleton />
      </InsightsSection>
    </div>
  );
}
