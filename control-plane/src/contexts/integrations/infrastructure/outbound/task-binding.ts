import type { IntegrationTaskView } from '@integrations/application/ports/integration-runtime.port';

export const taskBinding = (
  task: IntegrationTaskView,
): {
  title: string;
  url: string | null;
  pullRequest: string | null;
  line: string;
  station: string;
  stationKey: string;
  marks: Readonly<Record<string, string>>;
} => ({
  title: task.title,
  url: task.url,
  pullRequest: task.pullRequest,
  line: task.line,
  station: task.station,
  stationKey: task.stationKey,
  marks: task.marks,
});
