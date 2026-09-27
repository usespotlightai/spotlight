import { MemoryReviewAbout } from '@/components/features/inbox/memories/MemoryReviewAbout';
import { MemoryReviewSkeleton } from '@/components/features/inbox/memories/MemoryReviewSkeleton';
import { ProposedMemoryCard } from '@/components/features/inbox/memories/ProposedMemoryCard';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Button } from '@/components/ui/button';
import { useApproveMemories } from '@/hooks/api/useApproveMemories';
import { useMemoryReview } from '@/hooks/api/useMemoryReview';
import { useRejectMemory } from '@/hooks/api/useRejectMemory';
import { approvableTogether } from '@/lib/memory';
import { failed, loading } from '@/lib/query';

type MemoryReviewProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
};

export function MemoryReview({
  slug,
  teamId,
  taskId,
  runId,
}: MemoryReviewProps) {
  const query = useMemoryReview({ teamId, taskId, runId });
  const approve = useApproveMemories();
  const reject = useRejectMemory();
  const about = { slug, teamId, taskId, runId };
  const pending = approve.isPending || reject.isPending;

  if (loading(query)) {
    return <MemoryReviewSkeleton />;
  }

  if (failed(query)) {
    return (
      <CouldNotLoad
        what="The proposed memories"
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        className="items-start"
      />
    );
  }

  const memories = query.data?.memories ?? [];

  if (memories.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <MemoryReviewAbout />
        <p className="text-muted-foreground text-sm leading-6">
          This run proposed nothing left to keep. A later run may have replaced
          what it proposed.
        </p>
      </div>
    );
  }

  const together = approvableTogether(memories);
  const failedFor = (id: string) =>
    (approve.isError &&
      approve.variables?.memories.some((each) => each.id === id)) ||
    (reject.isError && reject.variables?.memoryId === id);

  return (
    <div className="flex flex-col gap-4">
      <MemoryReviewAbout />

      {together.length > 1 && (
        <Button
          size="sm"
          variant="outline"
          className="self-start rounded-full bg-card shadow-none"
          disabled={pending}
          onClick={() =>
            approve.mutate({
              ...about,
              memories: together.map((each) => ({ id: each.id })),
            })
          }
        >
          Approve all {together.length} from the team
        </Button>
      )}

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
    </div>
  );
}
