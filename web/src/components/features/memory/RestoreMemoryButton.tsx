import { DecisionButton } from '@/components/shared/DecisionButton';
import { useRestoreTeamMemory } from '@/hooks/api/useRestoreTeamMemory';

type RestoreMemoryButtonProps = {
  teamId: string;
  memoryId: string;
  restorable: boolean;
};

export function RestoreMemoryButton({
  teamId,
  memoryId,
  restorable,
}: RestoreMemoryButtonProps) {
  const restore = useRestoreTeamMemory();

  if (!restorable) {
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
