import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { FlaggedMemories } from '@/components/features/insights/memory/FlaggedMemories';
import { MemoryComparison } from '@/components/features/insights/memory/MemoryComparison';
import { MemorySkeleton } from '@/components/features/insights/memory/MemorySkeleton';
import { NoMemories } from '@/components/features/insights/memory/NoMemories';
import { useInsightsMemory } from '@/hooks/api/useInsightsMemory';
import type { InsightsPeriod } from '@/lib/insights';
import { memoryTiles, usedNoMemory } from '@/lib/insights-memory';
import { failed, loading } from '@/lib/query';

type MemoryTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
};

export function MemoryTab({ slug, teamId, period }: MemoryTabProps) {
  const memory = useInsightsMemory(teamId, period);

  if (loading(memory)) {
    return <MemorySkeleton />;
  }

  if (failed(memory) || !memory.data) {
    return <InsightsFailed what="The memory" query={memory} />;
  }

  const read = memory.data;

  if (usedNoMemory(read)) {
    return <NoMemories slug={slug} teamId={teamId} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <InsightsTiles label="Memory use">
        {memoryTiles(read).map((tile) => (
          <InsightsTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            detail={tile.detail}
          />
        ))}
      </InsightsTiles>

      <InsightsCard
        tableOnly
        title="Runs with memories and without"
        description="Outcomes of runs that got a memory in their brief or read one, compared with the other runs in this period."
      >
        <MemoryComparison
          runs={{
            without: read.withoutMemories.runs,
            with: read.withMemories.runs,
          }}
          verdicts={read.verdicts}
        />
      </InsightsCard>

      <FlaggedMemories slug={slug} teamId={teamId} flagged={read.flagged} />
    </div>
  );
}
