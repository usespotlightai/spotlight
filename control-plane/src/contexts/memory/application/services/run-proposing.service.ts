import type {
  RememberedTask,
  WorkPort,
} from '@memory/application/ports/work.port';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import type { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryProposalSetAlreadyOpenError } from '@memory/domain/exceptions/memory-proposal-set-already-open.error';
import { MemoryProposalSetVersionConflictError } from '@memory/domain/exceptions/memory-proposal-set-version-conflict.error';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import {
  type RememberedAt,
  Remembering,
} from '@memory/domain/services/remembering';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ProposingRun {
  readonly remembering: Remembering;
  readonly teamId: TeamId;
  readonly id: MemoryId;
  readonly at: RememberedAt;
  readonly now: Date;
}

interface Proposing {
  readonly remembering: Remembering;
  readonly runId: RunId;
  readonly teamId: TeamId;
  readonly task: RememberedTask;
  readonly at: Omit<RememberedAt, 'cited'>;
  readonly id: MemoryId;
}

export class RunProposing {
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly work: WorkPort,
    private readonly sets: MemoryProposalSetRepository,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async proposed(
    runId: string,
    runnerId: string,
    build: (run: ProposingRun) => MemoryProposal | Promise<MemoryProposal>,
  ): Promise<string> {
    const run = await this.loader.leased(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );
    const remembering = Remembering.of({
      taskId: run.taskId,
      runId: run.id,
      asOf: run.asOf,
      isolated: run.isolated,
      trial: run.trial,
    });

    const [task, runContext, steps] = await Promise.all([
      this.work.task(remembering.taskId),
      this.work.stationContextOf(run.id),
      this.work.reasoning(run.id),
    ]);

    if (!task || !runContext || !steps) {
      throw new UnknownRunError(runId);
    }

    const proposing: Proposing = {
      remembering,
      runId: run.id,
      teamId: run.teamId,
      task,
      at: { runContext, steps, fromOutside: task.fromOutside },
      id: MemoryId.of(this.ids.generate()),
    };
    const proposed = await this.proposedOnce(proposing, build).catch(
      (error: unknown) => {
        if (
          error instanceof MemoryProposalSetVersionConflictError ||
          error instanceof MemoryProposalSetAlreadyOpenError
        ) {
          return this.proposedOnce(proposing, build);
        }
        throw error;
      },
    );

    return proposed.id.value;
  }

  private proposedOnce(
    proposing: Proposing,
    build: (run: ProposingRun) => MemoryProposal | Promise<MemoryProposal>,
  ): Promise<{ id: MemoryId }> {
    const { remembering, runId, task } = proposing;

    return this.transaction.inTransaction(async () => {
      const found = await this.sets.forTask(remembering.taskId);
      const set =
        found ??
        MemoryProposalSet.create({
          id: MemoryProposalSetId.of(this.ids.generate()),
          taskId: remembering.taskId,
          workspaceId: task.workspaceId,
        });
      const proposal = await build({
        remembering,
        teamId: proposing.teamId,
        id: proposing.id,
        at: { ...proposing.at, cited: set.stepsRemembered(runId) },
        now: this.clock.now(),
      });
      const next = set.remember(proposal);

      if (next !== set) {
        await (found ? this.sets.save(next) : this.sets.add(next));
      }

      const stored = next.findProposal(proposal);

      if (!stored) {
        throw new UnknownMemoryError(proposal.id.value);
      }

      return { id: stored.id };
    });
  }
}
