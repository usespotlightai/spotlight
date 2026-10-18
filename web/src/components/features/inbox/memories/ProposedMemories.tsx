import { Spool } from 'lucide-react';
import { useState } from 'react';
import { MemoryReview } from '@/components/features/inbox/memories/MemoryReview';
import { ProposedMemoriesSkeleton } from '@/components/features/inbox/memories/ProposedMemoriesSkeleton';
import { Collapsible } from '@/components/shared/Collapsible';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useMemoryReview } from '@/hooks/api/useMemoryReview';
import { proposedSummary } from '@/lib/memory';
import { failed, loading } from '@/lib/query';

type ProposedMemoriesProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
};

export function ProposedMemories({
  slug,
  teamId,
  taskId,
  runId,
}: ProposedMemoriesProps) {
  const [open, setOpen] = useState(true);
  const review = useMemoryReview({ teamId, taskId, runId });
  const { data: harnesses } = useHarnesses();
  const memories = review.data?.memories ?? [];

  if (loading(review)) {
    return <ProposedMemoriesSkeleton />;
  }

  if (failed(review)) {
    return (
      <CouldNotLoad
        what="The memories this run proposed"
        retrying={review.isFetching}
        onRetry={() => void review.refetch()}
        className="items-start"
      />
    );
  }

  if (memories.length === 0) {
    return null;
  }

  const agent = harnesses?.find(
    (each) => each.id === memories[0]?.harness,
  )?.name;

  return (
    <div className="flex flex-col">
      <DisclosureToggle open={open} onToggle={() => setOpen((was) => !was)}>
        <Spool aria-hidden className="size-3.5" />
        {proposedSummary(memories, agent)}
      </DisclosureToggle>

      <Collapsible open={open} appear={false}>
        <div className="pt-3">
          <MemoryReview
            slug={slug}
            teamId={teamId}
            taskId={taskId}
            runId={runId}
            memories={memories}
          />
        </div>
      </Collapsible>
    </div>
  );
}
