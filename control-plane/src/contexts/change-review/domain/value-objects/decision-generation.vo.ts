import type { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class DecisionGeneration {
  private constructor(
    readonly turn: AgentTurn,
    readonly requestedAt: Date,
    readonly job: PendingJob,
  ) {}

  static requested(turn: AgentTurn, now: Date): DecisionGeneration {
    return new DecisionGeneration(turn, now, PendingJob.fresh());
  }

  static rehydrate(input: {
    turn: AgentTurn;
    requestedAt: Date;
    job: PendingJob;
  }): DecisionGeneration {
    return new DecisionGeneration(input.turn, input.requestedAt, input.job);
  }

  get runId(): RunId {
    return this.turn.runId;
  }

  isFor(turn: AgentTurn): boolean {
    return this.turn.equals(turn);
  }

  withJob(job: PendingJob): DecisionGeneration {
    return new DecisionGeneration(this.turn, this.requestedAt, job);
  }
}
