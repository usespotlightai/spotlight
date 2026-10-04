import { ProposedMemoryCard } from '@/components/features/inbox/memories/ProposedMemoryCard';
import { useApproveMemories } from '@/hooks/api/useApproveMemories';
import { useRejectMemory } from '@/hooks/api/useRejectMemory';
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
  const about = { slug, teamId, taskId, runId };
  const pending = approve.isPending || reject.isPending;

  const failedFor = (id: string) =>
    (approve.isError &&
      approve.variables?.memories.some((each) => each.id === id)) ||
    (reject.isError && reject.variables?.memoryId === id);

  return (
    <ul className="flex flex-col gap-3">
      {memories.map((memory, at) => (
        <ProposedMemoryCard
          key={memory.id}
          memory={memory}
          position={at + 1}
          pending={pending}
          failed={failedFor(memory.id)}
          onApprove={(body) =>
            approve.mutate({
              ...about,
              memories: [{ id: memory.id, ...(body ? { body } : {}) }],
            })
          }
          onReject={() => reject.mutate({ ...about, memoryId: memory.id })}
        />
      ))}
    </ul>
  );
}
