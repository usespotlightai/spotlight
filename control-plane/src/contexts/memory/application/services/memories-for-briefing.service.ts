import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { selectForBriefing } from '@memory/domain/services/briefing-selection';
import {
  layoutAt,
  MEMORY_FOLDER,
  mirroringAt,
} from '@memory/domain/services/memory-folder';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
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
    private readonly memories: MemoryRepository,
    private readonly uses: MemoryUsesPort,
  ) {}

  async forBriefing(place: BriefingPlace): Promise<BriefingSelection> {
    const applying = (await this.memories.mayReach(place)).filter(
      (each) => each.standing === 'stands' && each.scope.appliesAt(place),
    );
    const ids = applying.map((each) => each.id);
    const [touched, matches, recalled] = await Promise.all([
      applying.some((each) => each.scope.paths.length > 0)
        ? place.touched()
        : ([] as readonly TouchedFile[]),
      this.memories.matching(ids, place.about),
      this.uses.runsUsing(ids, 'recalled'),
    ]);

    const chosen = selectForBriefing(
      applying.map((memory) => ({
        memory,
        match: matches.get(memory.id.value) ?? 0,
        recalled: recalled.get(memory.id.value) ?? 0,
      })),
      {
        teamId: place.teamId,
        lineId: place.lineId,
        stationId: place.stationId,
        repositories: place.repositories,
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
        body: each.body,
      })),
      cut: chosen.cut.map((each) => ({
        id: each.id.value,
        handle: each.handle.value,
      })),
      folder:
        applying.length > 0
          ? {
              path: MEMORY_FOLDER,
              layout: layoutAt(place),
              mirroring: mirroringAt(place),
            }
          : null,
    };
  }
}
