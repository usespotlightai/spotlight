import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';

export const taskBinding = (
  task: TaskView,
): {
  title: string;
  url: string | null;
  pullRequest: string | null;
  pullRequests: readonly string[];
  line: string;
  station: string;
  stationKey: string;
  marks: Readonly<Record<string, string>>;
} => ({
  title: task.title,
  url: task.url,
  pullRequest: task.pullRequest?.value ?? null,
  pullRequests: task.pullRequests.map((each) => each.value),
  line: task.line.value,
  station: task.station.value,
  stationKey: task.stationKey.value,
  marks: task.marks,
});
