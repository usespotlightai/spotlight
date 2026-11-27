import { PillButton } from '@/components/shared/PillButton';
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
      <PillButton
        size="regular"
        className="pointer-coarse:h-9"
        disabled={restore.isPending}
        onClick={() => restore.mutate({ teamId, memoryId })}
      >
        Restore
      </PillButton>
    </div>
  );
}
