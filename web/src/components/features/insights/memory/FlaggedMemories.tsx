import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { FlaggedMemory } from '@/lib/insights-memory';
import { dayShown } from '@/lib/judge';
import { memoryPath } from '@/lib/memory';

type FlaggedMemoriesProps = {
  slug: string;
  teamId: string;
  flagged: readonly FlaggedMemory[];
};

export function FlaggedMemories({
  slug,
  teamId,
  flagged,
}: FlaggedMemoriesProps) {
  return (
    <InsightsCard
      title="Flagged wrong"
      description="Memories people retired as wrong this period. Replaced memories don’t count."
    >
      {flagged.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No memory flagged wrong in this period.
        </p>
      ) : (
        <ul
          aria-label="Memories flagged wrong"
          className="flex flex-col divide-y-[0.5px] divide-border"
        >
          {flagged.map((memory) => (
            <li
              key={memory.memoryId}
              data-slot="flagged-memory"
              className="flex flex-col gap-0.5 py-2"
            >
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <TrailLink
                  to={memoryPath(slug, teamId, memory.memoryId)}
                  className="font-mono text-muted-foreground text-xs hover:underline"
                >
                  {memory.handle}
                </TrailLink>
                <span className="text-foreground">{memory.body}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                {memory.reason ? `“${memory.reason}”` : 'No reason given'} —{' '}
                {memory.byName ?? 'A former member'},{' '}
                {dayShown(memory.at.slice(0, 10))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </InsightsCard>
  );
}
