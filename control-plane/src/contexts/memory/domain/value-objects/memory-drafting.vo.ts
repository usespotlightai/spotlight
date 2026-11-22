import type { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class MemoryDrafting {
  private constructor(
    readonly turn: AgentTurn,
    readonly requestedAt: Date,
    readonly job: PendingJob,
  ) {}

  static requested(turn: AgentTurn, now: Date): MemoryDrafting {
    return new MemoryDrafting(turn, now, PendingJob.fresh());
  }

  static rehydrate(input: {
    turn: AgentTurn;
    requestedAt: Date;
    job: PendingJob;
  }): MemoryDrafting {
    return new MemoryDrafting(input.turn, input.requestedAt, input.job);
  }

  get runId(): RunId {
    return this.turn.runId;
  }

  isFor(turn: AgentTurn): boolean {
    return this.turn.equals(turn);
  }

  withJob(job: PendingJob): MemoryDrafting {
    return new MemoryDrafting(this.turn, this.requestedAt, job);
  }
}
