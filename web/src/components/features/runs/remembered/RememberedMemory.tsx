import { RetirementNote } from '@/components/features/memory/RetirementNote';
import { MemoryHandleLink } from '@/components/features/runs/remembered/MemoryHandleLink';
import { RememberedCard } from '@/components/features/runs/remembered/RememberedCard';
import { KIND_LABELS, type TeamMemory } from '@/lib/memory';

type RememberedMemoryProps = {
  slug: string;
  teamId: string;
  memory: TeamMemory;
};

export function RememberedMemory({
  slug,
  teamId,
  memory,
}: RememberedMemoryProps) {
  return (
    <RememberedCard
      slot="remembered-memory"
      body={memory.body}
      about={[
        KIND_LABELS[memory.kind],
        <MemoryHandleLink
          key="handle"
          slug={slug}
          teamId={teamId}
          memoryId={memory.id}
          handle={memory.handle}
        />,
      ]}
      retirable={
        memory.standing === 'stands' ? { teamId, memoryId: memory.id } : null
      }
      footer={
        memory.retirement && <RetirementNote retirement={memory.retirement} />
      }
    />
  );
}
