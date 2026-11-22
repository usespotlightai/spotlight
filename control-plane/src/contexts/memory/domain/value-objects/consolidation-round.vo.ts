import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

/**
 * One session that consolidates a team's memories for a sweep: the team, when the sweep fell due, and the attempt of
 * the sweep's job. The next sweep or a retried job consolidates in a new round; a job that waits keeps its round.
 */
export class ConsolidationRound {
  private constructor(
    readonly teamId: TeamId,
    readonly dueAt: Date,
    readonly attempt: number,
  ) {}

  static of(input: {
    teamId: TeamId;
    dueAt: Date;
    attempt: number;
  }): ConsolidationRound {
    if (!Number.isInteger(input.attempt) || input.attempt < 0) {
      throw new InvalidMemoryError(
        `cannot run in attempt ${input.attempt}`,
        'consolidation round',
      );
    }

    if (Number.isNaN(input.dueAt.getTime())) {
      throw new InvalidMemoryError(
        'needs the time its sweep fell due',
        'consolidation round',
      );
    }

    return new ConsolidationRound(input.teamId, input.dueAt, input.attempt);
  }

  /** Whether it consolidates for the same sweep of the team, in whichever attempt. */
  sweeps(teamId: TeamId, dueAt: Date): boolean {
    return (
      this.teamId.equals(teamId) && this.dueAt.getTime() === dueAt.getTime()
    );
  }

  equals(other: ConsolidationRound): boolean {
    return (
      other.sweeps(this.teamId, this.dueAt) && this.attempt === other.attempt
    );
  }
}
