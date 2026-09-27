import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { distinct } from '@shared-kernel/domain/services/distinct';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const MOST_PATHS = 20;

export class MemoryScope {
  private constructor(
    readonly teamId: TeamId,
    readonly lineId: string | null,
    readonly stationId: string | null,
    readonly repository: Repository | null,
    readonly paths: readonly MemoryPath[],
  ) {}

  static of(input: {
    teamId: TeamId;
    lineId?: string | null;
    stationId?: string | null;
    repository?: Repository | null;
    paths?: readonly MemoryPath[];
  }): MemoryScope {
    const lineId = input.lineId?.trim() || null;
    const stationId = input.stationId?.trim() || null;
    const repository = input.repository ?? null;
    const paths = distinct(input.paths ?? []);

    if (stationId && !lineId) {
      throw new InvalidMemoryError('held at a station names its line too');
    }

    if (paths.length > 0 && !repository) {
      throw new InvalidMemoryError(
        'about paths names the repository they lie in',
      );
    }

    if (paths.length > MOST_PATHS) {
      throw new InvalidMemoryError(`bears on at most ${MOST_PATHS} paths`);
    }

    return new MemoryScope(input.teamId, lineId, stationId, repository, paths);
  }

  equals(other: MemoryScope): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.lineId === other.lineId &&
      this.stationId === other.stationId &&
      (this.repository === null
        ? other.repository === null
        : other.repository !== null &&
          this.repository.equals(other.repository)) &&
      this.paths.length === other.paths.length &&
      this.paths.every((each, at) => other.paths[at]?.equals(each))
    );
  }
}
