import { useState } from 'react';
import { RetireReply } from '@/components/features/memory/RetireReply';
import { SaveCancelButtons } from '@/components/features/memory/SaveCancelButtons';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PillButton } from '@/components/shared/PillButton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useTeamMemory } from '@/hooks/api/useTeamMemory';
import { failed, loading } from '@/lib/query';

type MemoryDetailsProps = {
  teamId: string;
  memoryId: string;
  open: boolean;
  editing: boolean;
  saving: boolean;
  unsaveable: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function MemoryDetails({
  teamId,
  memoryId,
  open,
  editing,
  saving,
  unsaveable,
  onEdit,
  onCancel,
  onSave,
}: MemoryDetailsProps) {
  const query = useTeamMemory(teamId, memoryId);
  const [retiring, setRetiring] = useState(false);

  if (!open && retiring) {
    setRetiring(false);
  }

  if (loading(query)) {
    return (
      <div
        role="status"
        aria-label="Loading the memory"
        className="flex flex-col text-xs leading-5"
      >
        <SkeletonLine className="w-2/3" />
        <SkeletonLine className="w-1/3" />
      </div>
    );
  }

  if (failed(query) || !query.data) {
    return (
      <CouldNotLoad
        what="This memory"
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        className="items-start"
      />
    );
  }

  const memory = query.data;
  const { retirement } = memory;

  return (
    <div className="flex flex-col gap-4 pt-1">
      {memory.superseded && (
        <p className="text-muted-foreground text-xs leading-5">
          Replaces: {memory.superseded.body}
        </p>
      )}

      {retirement && memory.successor && (
        <p className="text-muted-foreground text-xs leading-5">
          Replaced by: {memory.successor.body}
        </p>
      )}

      {memory.standing === 'stands' && !retiring && !editing && (
        <div className="flex flex-wrap items-center gap-2">
          <PillButton onClick={onEdit}>Edit</PillButton>
          <PillButton
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setRetiring(true)}
          >
            Retire
          </PillButton>
        </div>
      )}

      {editing && (
        <SaveCancelButtons
          saving={saving}
          unsaveable={unsaveable}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}

      <RetireReply
        open={retiring}
        retirable={memory.standing === 'stands' ? { teamId, memoryId } : null}
        onCancel={() => setRetiring(false)}
      />
    </div>
  );
}
