import { ProposedMemoryCard } from '@/components/features/inbox/memories/ProposedMemoryCard';
import { useApproveMemories } from '@/hooks/api/useApproveMemories';
import { useRejectMemory } from '@/hooks/api/useRejectMemory';
import { useRestoreMemory } from '@/hooks/api/useRestoreMemory';
import type { ProposedMemory } from '@/lib/memory';
import { nonEmpty } from '@/lib/non-empty';

type MemoryDecisionProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  memory: ProposedMemory;
  position: number;
};

export function MemoryDecision({
  slug,
  teamId,
  taskId,
  runId,
  memory,
  position,
}: MemoryDecisionProps) {
  const approve = useApproveMemories();
  const reject = useRejectMemory();
  const restore = useRestoreMemory();
  const about = { slug, teamId, taskId, runId };

  return (
    <ProposedMemoryCard
      memory={memory}
      position={position}
      pending={approve.isPending || reject.isPending || restore.isPending}
      onApprove={(body) =>
        approve.mutate({
          ...about,
          memories: [
            {
              id: memory.id,
              ...(nonEmpty(body) ? { body } : {}),
            },
          ],
        })
      }
      onReject={() => reject.mutate({ ...about, memoryId: memory.id })}
      onRestore={() => restore.mutate({ ...about, memoryId: memory.id })}
    />
  );
}
