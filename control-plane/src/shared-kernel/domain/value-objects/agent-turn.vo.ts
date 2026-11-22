import { InvalidAgentTurnError } from '@shared-kernel/domain/exceptions/invalid-agent-turn.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class AgentTurn {
  private constructor(
    readonly runId: RunId,
    readonly attempt: number,
    readonly runOrderedAt: Date,
  ) {}

  static of(runId: RunId, attempt: number, runOrderedAt: Date): AgentTurn {
    if (!Number.isInteger(attempt) || attempt < 1) {
      throw new InvalidAgentTurnError(
        `cannot be attempt ${attempt} of run ${runId.value}`,
      );
    }
    if (Number.isNaN(runOrderedAt.getTime())) {
      throw new InvalidAgentTurnError(
        `needs the time run ${runId.value} was ordered`,
      );
    }

    return new AgentTurn(runId, attempt, runOrderedAt);
  }

  equals(other: AgentTurn): boolean {
    return this.runId.equals(other.runId) && this.attempt === other.attempt;
  }

  covers(other: AgentTurn): boolean {
    if (this.runId.equals(other.runId)) {
      return this.attempt >= other.attempt;
    }

    const ordered = this.runOrderedAt.getTime();
    const otherOrdered = other.runOrderedAt.getTime();

    return ordered === otherOrdered
      ? this.runId.value > other.runId.value
      : ordered > otherOrdered;
  }
}
