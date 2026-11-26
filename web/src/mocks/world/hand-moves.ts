import type {
  StationResponseDto,
  TaskHandMoveResponseDto,
  TaskResponseDto,
} from '@/lib/api';
import { world } from '@/mocks/world';

const denialOf = (
  task: TaskResponseDto,
  from: StationResponseDto,
  to: StationResponseDto,
): TaskHandMoveResponseDto['denial'] => {
  if (from.id === to.id) {
    return null;
  }
  if (task.hold && !task.hold.viewerEnds) {
    return 'on-hold';
  }
  if (from.kind === 'completed') {
    return 'out-of-completed';
  }

  const starts = from.kind === 'backlog' && to.kind === 'work';
  const parks = from.kind === 'work' && to.kind === 'backlog';

  return starts || parks || to.kind === 'completed'
    ? null
    : 'between-work-stations';
};

export const withHandMoves = (
  teamId: string,
  task: TaskResponseDto,
): TaskResponseDto => {
  const stations =
    (world().lines[teamId] ?? []).find((line) =>
      line.stations.some((each) => each.id === task.stationId),
    )?.stations ?? [];
  const from = stations.find((each) => each.id === task.stationId);

  return {
    ...task,
    handMoves: from
      ? stations.map((to, at) => {
          const denial = denialOf(task, from, to);

          return {
            stationId: to.id,
            denial,
            skips:
              denial === null && from.kind === 'backlog' && to.kind === 'work'
                ? stations
                    .slice(0, at)
                    .filter((each) => each.kind === 'work')
                    .map((each) => each.id)
                : [],
          };
        })
      : [],
  };
};
