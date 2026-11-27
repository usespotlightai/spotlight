import { MemoryDecision } from '@/components/features/inbox/memories/MemoryDecision';
import { ProposedMemories } from '@/components/features/inbox/memories/ProposedMemories';
import { RunThread } from '@/components/features/inbox/RunThread';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useMemoryReview } from '@/hooks/api/useMemoryReview';
import type { DockedDecision } from '@/lib/decision-tray';
import { memoryDecisionId, undecided } from '@/lib/memory';

type MemoryThreadProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  trail: readonly BreadcrumbSegment[];
};

export function MemoryThread({
  slug,
  teamId,
  taskId,
  runId,
  trail,
}: MemoryThreadProps) {
  const review = useMemoryReview({ teamId, taskId, runId });
  const about = { slug, teamId, taskId, runId };
  const docked = (review.data?.memories ?? []).flatMap(
    (memory, at): DockedDecision[] =>
      undecided(memory)
        ? [
            {
              id: memoryDecisionId(memory),
              kind: 'Memory proposal',
              label: `Memory ${at + 1}`,
              group: 'Memories proposed',
              content: (
                <MemoryDecision {...about} memory={memory} position={at + 1} />
              ),
            },
          ]
        : [],
  );

  return (
    <RunThread
      {...about}
      trail={trail}
      docked={docked}
      after={<ProposedMemories {...about} />}
    />
  );
}
