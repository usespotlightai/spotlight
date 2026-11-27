import { useState } from 'react';

import { useEditMemory } from '@/hooks/api/useEditMemory';
import { type MemoryDraftResult, useMemoryDraft } from '@/hooks/useMemoryDraft';
import type { LineResponseDto } from '@/lib/api';
import type { TeamMemory } from '@/lib/memory';

type MemoryEditingResult = {
  editing: boolean;
  draft: MemoryDraftResult;
  saving: boolean;
  unsaveable: boolean;
  start: () => void;
  cancel: () => void;
  save: () => void;
};

export function useMemoryEditing(
  teamId: string,
  memory: TeamMemory,
  lines: readonly LineResponseDto[],
  open: boolean,
): MemoryEditingResult {
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
