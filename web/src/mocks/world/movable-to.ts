import type { StationResponseDto, TaskResponseDto } from '@/lib/api';
import { movableByHand } from '@/lib/task';
import { world } from '@/mocks/world';

const passesOn = (
  task: TaskResponseDto,
  from: StationResponseDto,
  to: StationResponseDto,
): boolean =>
  task.awaitingReview !== null &&
  task.hold === null &&
  to.id !== from.id &&
  to.harness !== null &&
  from.passesTo.includes(to.id);

export const withMovableTo = (
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
    movableTo: from
      ? stations
          .filter((to) => movableByHand(from, to) || passesOn(task, from, to))
          .map((to) => to.id)
      : [],
  };
};
