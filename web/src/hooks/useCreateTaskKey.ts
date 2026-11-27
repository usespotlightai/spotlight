import { useEffect, useEffectEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useCommands } from '@/hooks/useCommands';
import type { LineResponseDto } from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';
import { creatingOf, entryStationOf } from '@/lib/task-create';

export function useCreateTaskKey(
  line: LineResponseDto | undefined,
  onCreate: (stationId: string) => void,
): void {
  const location = useLocation();
  const navigate = useNavigate();
  const entry = line ? entryStationOf(line) : null;
  const creating = creatingOf(location.state);
  const [created, setCreated] = useState<number | null>(null);
  const forgetCreating = useEffectEvent(() =>
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    }),
  );

  if (creating !== null && creating !== created && nonEmpty(entry)) {
    setCreated(creating);
    onCreate(entry);
  }

  useEffect(() => {
    if (created !== null) {
      void forgetCreating();
    }
  }, [created]);

  useCommands(
    nonEmpty(entry) ? [{ id: 'task.create', run: () => onCreate(entry) }] : [],
  );
}
