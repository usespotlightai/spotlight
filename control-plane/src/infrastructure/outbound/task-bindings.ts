import type { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';

const marksOf = (task: Task): Record<string, string> => {
  const marks: Record<string, string> = {};

  for (const mark of task.marks) {
    marks[mark.kind] = mark.value;
  }

  return marks;
};

export const taskBinding = (
  task: Task,
  line: Line,
): {
  line: string;
  station: string;
  stationKey: string;
  marks: Record<string, string>;
} => {
  const station = line.stationAt(task.stationId);

  return {
    line: line.key.value,
    station: station?.name.value ?? '',
    stationKey: station?.key.value ?? '',
    marks: marksOf(task),
  };
};
