import type { LineDefinitionStation } from '@work/application/contracts/line-definition.contract';
import type {
  SearchSight,
  SearchSightPort,
} from '@work/application/ports/search-sight.port';

export const BUILD_BLOCK: LineDefinitionStation = {
  key: 'build',
  name: 'Build',
  kind: 'work',
  harness: 'claude-code',
  prompt: 'Build it, then drain the queue.',
  alerts: [],
  tools: [],
  skills: [],
  passesTo: ['ship'],
  ends: false,
};

export const aSight = (over: Partial<SearchSight> = {}): SearchSight => ({
  stationId: 'station_1',
  hiddenTasks: [],
  shownOriginals: [],
  candidates: [],
  seedBlock: BUILD_BLOCK,
  ...over,
});

export const sightsInMemory = (
  otherwise?: SearchSightPort,
): SearchSightPort & {
  sees(runId: string, sight: SearchSight): void;
} => {
  const sights = new Map<string, SearchSight>();

  return {
    sees: (runId, sight) => {
      sights.set(runId, sight);
    },
    of: async (runId) => {
      const sight = sights.get(runId);

      if (sight) {
        return sight;
      }

      if (otherwise) {
        return otherwise.of(runId);
      }

      throw new Error(`No search ran ${runId}`);
    },
  };
};
