import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';

export const processedEventsInMemory = (): ProcessedEventsPort => {
  const processed = new Set<string>();

  return {
    wasProcessed: (workspaceId, key) =>
      Promise.resolve(processed.has(`${workspaceId.value}/${key}`)),
    markProcessed: (workspaceId, key) => {
      const first = !processed.has(`${workspaceId.value}/${key}`);
      processed.add(`${workspaceId.value}/${key}`);
      return Promise.resolve(first);
    },
    purgeBefore: () => Promise.resolve(0),
  };
};
