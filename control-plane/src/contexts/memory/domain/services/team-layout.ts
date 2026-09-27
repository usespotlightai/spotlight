import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface LaidOutLine {
  readonly id: string;
  readonly stations: readonly string[];
  readonly repositories: readonly Repository[];
}

export interface WrittenScope {
  readonly lineId?: string | null;
  readonly stationId?: string | null;
  readonly repository?: string | null;
  readonly paths?: readonly string[];
}

export class TeamLayout {
  private constructor(
    private readonly teamId: TeamId,
    private readonly lines: readonly LaidOutLine[],
  ) {}

  static of(input: {
    teamId: TeamId;
    lines: readonly LaidOutLine[];
  }): TeamLayout {
    return new TeamLayout(input.teamId, input.lines);
  }

  scopeOf(written: WrittenScope): MemoryScope {
    const lineId = written.lineId?.trim() || null;
    const stationId = written.stationId?.trim() || null;
    const line = lineId ? this.lines.find((each) => each.id === lineId) : null;

    if (lineId && !line) {
      throw new InvalidMemoryError('is held at a line of its team');
    }

    if (stationId && !line?.stations.includes(stationId)) {
      throw new InvalidMemoryError('is held at a station of its line');
    }

    const named = written.repository?.trim() || null;
    const repository = named
      ? (line ? [line] : this.lines)
          .flatMap((each) => each.repositories)
          .find((each) => each.value === named)
      : null;

    if (named && !repository) {
      throw new InvalidMemoryError(
        'names only a repository its team, or its line, works in',
      );
    }

    return MemoryScope.of({
      teamId: this.teamId,
      lineId,
      stationId,
      repository,
      paths: (written.paths ?? [])
        .filter((each) => each.trim())
        .map(MemoryPath.of),
    });
  }
}
