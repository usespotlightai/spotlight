import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';

export const taskBinding = (
  task: BoundTaskDto,
): {
  line: string;
  station: string;
  stationKey: string;
  marks: Readonly<Record<string, string>>;
} => ({
  line: task.line,
  station: task.station,
  stationKey: task.stationKey,
  marks: task.marks,
});
