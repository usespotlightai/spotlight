import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import { folderLayoutAt } from '@memory/application/rendering/memory-folder-layout';
import type { MemoriesInReach } from '@memory/application/services/memories-in-reach.service';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { selectForBriefing } from '@memory/domain/services/briefing-selection';
import {
  MEMORY_FOLDER,
  mirroringAt,
} from '@memory/domain/services/memory-folder';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import type { RunSite } from '@memory/domain/value-objects/run-site';
import type {
  BriefingPlace,
  BriefingSelection,
  TeamMemoriesPort,
  TouchedFile,
} from '@work/application/ports/team-memories.port';

const pathOf = (raw: string): MemoryPath | null => {
  try {
    return MemoryPath.of(raw);
  } catch (error) {
    if (error instanceof InvalidMemoryError) {
      return null;
    }
    throw error;
  }
};

export class MemoriesForBriefing implements TeamMemoriesPort {
  constructor(
    private readonly inReach: MemoriesInReach,
    private readonly relevance: MemoryRelevancePort,
    private readonly uses: MemoryUsesPort,
  ) {}

  async forBriefing(place: BriefingPlace): Promise<BriefingSelection> {
    const site: RunSite = {
      teamId: place.teamId,
      lineId: place.lineId,
      stationId: place.stationId,
      repositories: place.repositories,
    };
    const applying = await this.inReach.at(site);
    const ids = applying.map((each) => each.id);
    const [touched, ranks, recalled] = await Promise.all([
      applying.some((each) => each.scope.paths.length > 0)
        ? place.touched()
        : ([] as readonly TouchedFile[]),
      this.relevance.rank(ids, place.about),
      this.uses.runsUsing(ids, 'recalled'),
    ]);

    const chosen = selectForBriefing(
      applying.map((memory) => ({
        memory,
        rank: ranks.get(memory.id.value) ?? 0,
        recalled: recalled.get(memory.id.value) ?? 0,
      })),
      {
        ...site,
        touched: touched.flatMap((each) => {
          const path = pathOf(each.path);
          return path ? [{ repository: each.repository, path }] : [];
        }),
      },
    );

    return {
      briefed: chosen.briefed.map((each) => ({
        id: each.id.value,
        handle: each.handle.value,
        kind: each.kind,
        body: each.body.value,
      })),
      cut: chosen.cut.map((each) => ({
        id: each.id.value,
        handle: each.handle.value,
      })),
      folder:
        applying.length > 0
          ? {
              path: MEMORY_FOLDER,
              layout: folderLayoutAt(site),
              mirroring: mirroringAt(site),
            }
          : null,
    };
  }
}
