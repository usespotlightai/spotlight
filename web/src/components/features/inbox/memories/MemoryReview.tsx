import { ProposedMemoryCard } from '@/components/features/inbox/memories/ProposedMemoryCard';
import { useApproveMemories } from '@/hooks/api/useApproveMemories';
import { useRejectMemory } from '@/hooks/api/useRejectMemory';
import { useRestoreMemory } from '@/hooks/api/useRestoreMemory';
import type { ProposedMemory } from '@/lib/memory';

type MemoryReviewProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  memories: readonly ProposedMemory[];
};

export function MemoryReview({
  slug,
  teamId,
  taskId,
  runId,
  memories,
}: MemoryReviewProps) {
  const approve = useApproveMemories();
  const reject = useRejectMemory();
  const restore = useRestoreMemory();
  const about = { slug, teamId, taskId, runId };
  const deciding = new Set([
    ...(approve.isPending
      ? (approve.variables?.memories ?? []).map((each) => each.id)
      : []),
    ...(reject.isPending && reject.variables
      ? [reject.variables.memoryId]
      : []),
    ...(restore.isPending && restore.variables
      ? [restore.variables.memoryId]
      : []),
  ]);

  return (
    <ul className="flex flex-col gap-3">
      {memories.map((memory, at) => (
        <ProposedMemoryCard
          key={memory.id}
          memory={memory}
          position={at + 1}
          pending={deciding.has(memory.id)}
          onApprove={(body) =>
            approve.mutate({
              ...about,
              memories: [{ id: memory.id, ...(body ? { body } : {}) }],
            })
          }
          onReject={() => reject.mutate({ ...about, memoryId: memory.id })}
          onRestore={() => restore.mutate({ ...about, memoryId: memory.id })}
        />
      ))}
    </ul>
  );
}
