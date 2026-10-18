import type { LineDefinitionStation } from '@work/application/contracts/line-definition.contract';
import type {
  SearchVisibility,
  SearchVisibilityPort,
} from '@work/application/ports/search-visibility.port';

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

export const aSearchVisibility = (
  over: Partial<SearchVisibility> = {},
): SearchVisibility => ({
  stationId: 'station_1',
  heldOutTasks: [],
  shownOriginals: [],
  candidates: [],
  seedBlock: BUILD_BLOCK,
  ...over,
});

export const searchVisibilitiesInMemory = (
  otherwise?: SearchVisibilityPort,
): SearchVisibilityPort & {
  sees(runId: string, visibility: SearchVisibility): void;
} => {
  const visibilities = new Map<string, SearchVisibility>();

  return {
    sees: (runId, visibility) => {
      visibilities.set(runId, visibility);
    },
    of: async (runId) => {
      const visibility = visibilities.get(runId);

      if (visibility) {
        return visibility;
      }

      if (otherwise) {
        return otherwise.of(runId);
      }

      throw new Error(`No search ran ${runId}`);
    },
  };
};
