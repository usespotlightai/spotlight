import { useState } from 'react';
import { useEditMemory } from '@/hooks/api/useEditMemory';
import { useMemoryDraft } from '@/hooks/useMemoryDraft';
import type { LineResponseDto } from '@/lib/api';
import type { TeamMemory } from '@/lib/memory';

export function useMemoryEditing(
  teamId: string,
  memory: TeamMemory,
  lines: readonly LineResponseDto[],
  open: boolean,
) {
  const [editing, setEditing] = useState(false);
  const draft = useMemoryDraft(memory, lines);
  const edit = useEditMemory();
  const unsaveable = draft.empty || edit.isPending;

  if (!open && editing) {
    setEditing(false);
  }

  return {
    editing,
    draft,
    saving: edit.isPending,
    unsaveable,
    start: () => {
      draft.reset(memory);
      edit.reset();
      setEditing(true);
    },
    cancel: () => setEditing(false),
    save: () => {
      if (!unsaveable) {
        edit.mutate(
          { teamId, memoryId: memory.id, memory: draft.written() },
          { onSuccess: () => setEditing(false) },
        );
      }
    },
  };
}
