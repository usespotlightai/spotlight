import type {
  MemoryRemembering,
  RememberCommand,
} from '@memory/application/commands/remember.command';
import type { ProposedMemoryDto } from '@memory/application/dto/memory-review.dto';
import type {
  RememberedTask,
  WorkPort,
} from '@memory/application/ports/work.port';
import type { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import { MemoryDraftVersionConflictError } from '@memory/domain/exceptions/memory-draft-version-conflict.error';
import { UnknownMemoryError } from '@memory/domain/exceptions/unknown-memory.error';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import {
  type RememberedStep,
  Remembering,
} from '@memory/domain/services/remembering';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { StationContext } from '@memory/domain/value-objects/run-context';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Remembrance {
  readonly remembering: Remembering;
  readonly runId: RunId;
  readonly task: RememberedTask;
  readonly runContext: StationContext;
  readonly steps: readonly RememberedStep[];
  readonly supersedes: Memory | null;
  readonly input: MemoryRemembering;
  readonly id: MemoryId;
}

export class RememberHandler
  implements CommandHandlerPort<RememberCommand, ProposedMemoryDto>
{
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly work: WorkPort,
    private readonly drafts: MemoryDraftRepository,
    private readonly memories: MemoryRepository,
    private readonly reviews: MemoryReviews,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RememberCommand): Promise<ProposedMemoryDto> {
    try {
      const run = await this.loader.leased(command.runId, command.runnerId);
      const remembering = Remembering.of({
        taskId: run.taskId,
        runId: run.id,
        replay: run.replaysFrom !== null,
        isSearch: run.isSearch,
      });

      const [task, runContext, steps, supersedes] = await Promise.all([
        this.work.task(remembering.taskId),
        this.work.stationContextOf(run.id),
        this.work.reasoning(run.id),
        this.superseded(run.teamId, command.remembering.supersedes),
      ]);

      if (!task || !runContext || !steps) {
        throw new UnknownRunError(command.runId);
      }

      const remembrance: Remembrance = {
        remembering,
        runId: run.id,
        task,
        runContext,
        steps,
        supersedes,
        input: command.remembering,
        id: MemoryId.of(this.ids.generate()),
      };
      const remembered = await this.rememberedOnce(remembrance).catch(
        (error: unknown) => {
          if (error instanceof MemoryDraftVersionConflictError) {
            return this.rememberedOnce(remembrance);
          }
          throw error;
        },
      );
      const review = await this.reviews.of(remembered.draft, run.id);
      const shown = review.memories.find(
        (each) => each.id === remembered.id.value,
      );

      if (!shown) {
        throw new UnknownMemoryError(remembered.id.value);
      }

      return shown;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async superseded(
    teamId: TeamId,
    raw: string | null,
  ): Promise<Memory | null> {
    if (!raw?.trim()) {
      return null;
    }

    const handle = MemoryHandle.parse(raw);
    const memory = await this.memories.withHandle(teamId, handle);

    if (!memory) {
      throw new UnknownMemoryError(handle.value);
    }

    return memory;
  }

  private rememberedOnce(
    remembrance: Remembrance,
  ): Promise<{ draft: MemoryDraft; id: MemoryId }> {
    const { remembering, runId, task, runContext, input } = remembrance;

    return this.transaction.inTransaction(async () => {
      const found = await this.drafts.forTask(remembering.taskId);
      const draft =
        found ??
        MemoryDraft.create({
          id: MemoryDraftId.of(this.ids.generate()),
          taskId: remembering.taskId,
          workspaceId: task.workspaceId,
        });
      const proposal = remembering.proposalOf({
        id: remembrance.id,
        remembered: {
          kind: input.kind,
          body: input.body,
          scope: input.scope,
          paths: input.paths,
          supersedes: remembrance.supersedes,
        },
        at: {
          runContext,
          steps: remembrance.steps,
          cited: draft.stepsRemembered(runId),
          fromOutside: task.fromOutside,
        },
        now: this.clock.now(),
      });
      const next = draft.remember(proposal);

      if (next !== draft) {
        await (found ? this.drafts.save(next) : this.drafts.add(next));
      }

      const stored = next.findProposal(proposal);

      if (!stored) {
        throw new UnknownMemoryError(proposal.id.value);
      }

      return { draft: next, id: stored.id };
    });
  }
}
