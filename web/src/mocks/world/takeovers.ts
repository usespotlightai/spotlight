import type { TaskPersonResponseDto } from '@/lib/api';
import { world } from '@/mocks/world';

export const takenOverBy = (
  teamId: string,
  taskId: string,
  by: TaskPersonResponseDto,
) => {
  world().tasks[teamId] = (world().tasks[teamId] ?? []).map((each) =>
    each.id === taskId
      ? {
          ...each,
          progress: null,
          assignee: by,
          takeover: {
            by,
            verdict: 'not-right',
            startedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
            runId: world().runs[taskId]?.[0]?.id ?? null,
            heldMoveTo: null,
          },
        }
      : each,
  );
};
