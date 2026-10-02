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
import type { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import { MemoryDraftMovedOnError } from '@memory/domain/exceptions/memory-draft-moved-on.error';
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
import type { StationSite } from '@memory/domain/value-objects/run-site';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
  readonly site: StationSite;
  readonly steps: readonly RememberedStep[];
  readonly supersedes: Memory | null;
  readonly asked: MemoryRemembering;
  readonly id: MemoryId;
}

export class RememberHandler
  implements CommandHandlerPort<RememberCommand, ProposedMemoryDto>
{
  constructor(
    private readonly atHand: RunnerMemoryAtHand,
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
      const held = await this.atHand.held(command.runId, command.runnerId);
      const remembering = Remembering.of({
        taskId: held.taskId,
        runId: held.id,
        replay: held.replaysFrom !== null,
      });

      const [task, site, steps, supersedes] = await Promise.all([
        this.work.task(remembering.taskId),
        this.work.stationSiteOf(held.id),
        this.work.reasoning(held.id),
        this.superseded(held.teamId, command.remembering.supersedes),
      ]);

      if (!task || !site || !steps) {
        throw new UnknownRunError(command.runId);
      }

      const remembrance: Remembrance = {
        remembering,
        runId: held.id,
        task,
        site,
        steps,
        supersedes,
        asked: command.remembering,
        id: MemoryId.of(this.ids.generate()),
      };
      const remembered = await this.rememberedOnce(remembrance).catch(
        (error: unknown) => {
          if (error instanceof MemoryDraftMovedOnError) {
            return this.rememberedOnce(remembrance);
          }
          throw error;
        },
      );
      const review = await this.reviews.of(remembered.draft, held.id);
      const shown = review.memories.find(
        (each) => each.id === remembered.id.value,
      );

      if (!shown) {
        throw new UnknownMemoryError(remembered.id.value);
      }

      return shown;
    } catch (error) {
      rethrowAsFault(error);
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
    const { remembering, runId, task, site, asked } = remembrance;

    return this.transaction.run(async () => {
      const found = await this.drafts.forTask(remembering.taskId);
      const draft =
        found ??
        MemoryDraft.opened({
          id: MemoryDraftId.of(this.ids.generate()),
          taskId: remembering.taskId,
          workspaceId: task.workspaceId,
        });
      const proposal = remembering.proposalOf({
        id: remembrance.id,
        remembered: {
          kind: asked.kind,
          body: asked.body,
          reach: asked.reach,
          paths: asked.paths,
          supersedes: remembrance.supersedes,
        },
        at: {
          site,
          steps: remembrance.steps,
          cited: draft.stepsRemembered(runId),
          fromOutside: task.fromOutside,
        },
        now: this.clock.now(),
      });
      const next = draft.remembered(proposal);

      if (next !== draft) {
        await (found ? this.drafts.save(next) : this.drafts.add(next));
      }

      const kept = next.holding(proposal);

      if (!kept) {
        throw new UnknownMemoryError(proposal.id.value);
      }

      return { draft: next, id: kept.id };
    });
  }
}
