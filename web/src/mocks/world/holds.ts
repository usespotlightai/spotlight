import type { TaskPersonResponseDto } from '@/lib/api';
import { world } from '@/mocks/world';

export const onHoldBy = (
  teamId: string,
  taskId: string,
  by: TaskPersonResponseDto,
) => {
  const [turn, ...before] = world().runs[taskId] ?? [];
  if (turn) {
    world().runs[taskId] = [
      {
        ...turn,
        driver: 'person',
        state: 'completed',
        progress: null,
        exitCode: 0,
      },
      ...before,
    ];
  }
  world().tasks[teamId] = (world().tasks[teamId] ?? []).map((each) =>
    each.id === taskId
      ? {
          ...each,
          progress: null,
          assignee: by,
          hold: {
            by,
            verdict: 'not-right',
            startedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
            runId: turn?.id ?? null,
            heldMoveTo: null,
          },
        }
      : each,
  );
};
