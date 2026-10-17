import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';

export const processedEventsInMemory = (): ProcessedEventsPort => {
  const processed = new Set<string>();

  return {
    wasProcessed: async (workspaceId, key) =>
      processed.has(`${workspaceId.value}/${key}`),
    markProcessed: async (workspaceId, key) => {
      const first = !processed.has(`${workspaceId.value}/${key}`);
      processed.add(`${workspaceId.value}/${key}`);
      return first;
    },
    purgeBefore: async () => 0,
  };
};
