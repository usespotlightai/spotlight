import { useState } from 'react';
import { MemoryForm } from '@/components/features/memory/MemoryForm';
import { MemoryGrounds } from '@/components/features/memory/MemoryGrounds';
import { RetireReply } from '@/components/features/memory/RetireReply';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Button } from '@/components/ui/button';
import { useEditMemory } from '@/hooks/api/useEditMemory';
import { useTeamMemory } from '@/hooks/api/useTeamMemory';
import type { LineResponseDto } from '@/lib/api';
import { failed, loading } from '@/lib/query';
import { runPath } from '@/lib/run';
import { taskPath } from '@/lib/task';

type MemoryDetailsProps = {
  slug: string;
  teamId: string;
  memoryId: string;
  lines: readonly LineResponseDto[];
};

const LINK = 'text-foreground text-xs underline-offset-4 hover:underline';

export function MemoryDetails({
  slug,
  teamId,
  memoryId,
  lines,
}: MemoryDetailsProps) {
  const query = useTeamMemory(teamId, memoryId);
  const edit = useEditMemory();
  const [editing, setEditing] = useState(false);
  const [retiring, setRetiring] = useState(false);

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
  const { grounds, retirement } = memory;

  return (
    <div className="flex flex-col gap-3">
      <MemoryGrounds grounds={memory} startsOpen={false} />

      {grounds && (
        <p className="flex gap-3">
          <TrailLink to={runPath(slug, teamId, grounds.runId)} className={LINK}>
            Open the run it came from
          </TrailLink>
          <TrailLink
            to={taskPath(slug, teamId, grounds.taskId)}
            className={LINK}
          >
            Open its task
          </TrailLink>
        </p>
      )}

      {memory.superseded && (
        <p className="text-muted-foreground text-xs leading-5">
          It replaced: {memory.superseded.body}
        </p>
      )}

      {retirement && memory.successor && (
        <p className="text-muted-foreground text-xs leading-5">
          Replaced by: {memory.successor.body}
        </p>
      )}

      {memory.standing === 'stands' && !retiring && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              edit.reset();
              setEditing(true);
            }}
          >
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRetiring(true)}>
            Retire
          </Button>
        </div>
      )}

      {editing && (
        <MemoryForm
          open={editing}
          onOpenChange={setEditing}
          title="Correct this memory"
          submitLabel="Replace it"
          initial={memory}
          lines={lines}
          pending={edit.isPending}
          failed={edit.isError}
          onSave={(written) =>
            edit.mutate(
              { teamId, memoryId, memory: written },
              { onSuccess: () => setEditing(false) },
            )
          }
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
