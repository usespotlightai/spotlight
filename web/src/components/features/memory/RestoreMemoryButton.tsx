import { DecisionButton } from '@/components/shared/DecisionButton';
import { useRestoreTeamMemory } from '@/hooks/api/useRestoreTeamMemory';
import type { TeamMemory } from '@/lib/memory';

type RestoreMemoryButtonProps = {
  teamId: string;
  memoryId: string;
  retirement: TeamMemory['retirement'];
};

export function RestoreMemoryButton({
  teamId,
  memoryId,
  retirement,
}: RestoreMemoryButtonProps) {
  const restore = useRestoreTeamMemory();

  if (!retirement || retirement.supersededBy) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DecisionButton
        className="min-w-0"
        disabled={restore.isPending}
        onClick={() => restore.mutate({ teamId, memoryId })}
      >
        Restore
      </DecisionButton>
    </div>
  );
}
