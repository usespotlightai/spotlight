import { RetirementNote } from '@/components/features/memory/RetirementNote';
import { MemoryCard } from '@/components/features/runs/memories/MemoryCard';
import { MemoryHandleLink } from '@/components/features/runs/memories/MemoryHandleLink';
import { KIND_LABELS, type TeamMemory } from '@/lib/memory';

type BriefedMemoryProps = {
  slug: string;
  teamId: string;
  memory: TeamMemory;
};

export function BriefedMemory({ slug, teamId, memory }: BriefedMemoryProps) {
  return (
    <MemoryCard
      slot="run-briefed-memory"
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
        memory.status === 'active' ? { teamId, memoryId: memory.id } : null
      }
      footer={
        memory.retirement && <RetirementNote retirement={memory.retirement} />
      }
    />
  );
}
