import type { TaskPersonResponseDto } from '@/lib/api';
import { world } from '@/mocks/world';
import { seenAgain } from '@/mocks/world/work';

export const onHoldBy = (
  teamId: string,
  taskId: string,
  by: TaskPersonResponseDto,
): void => {
  const runs = world().runs[taskId] ?? [];
  const turn = runs.at(0);
  const before = runs.slice(1);
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
            startedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
            runId: turn?.id ?? null,
            heldMoveTo: null,
            chatId: null,
            viewerDrives: true,
            viewerEnds: true,
          },
        }
      : each,
  );
  seenAgain(teamId, taskId);
};
