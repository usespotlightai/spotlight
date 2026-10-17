import type { IntegrationTaskView } from '@integrations/application/ports/integration-runtime.port';

export const taskBinding = (
  task: IntegrationTaskView,
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
