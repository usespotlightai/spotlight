import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { BriefedTasksPort } from '@work/application/ports/briefed-tasks.port';
import type { BuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';
import type { ContentHashPort } from '@work/application/ports/content-hash.port';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { MemoriesBriefedBeforePort } from '@work/application/ports/memories-briefed-before.port';
import type { ReplayAnswer } from '@work/application/ports/replay-dispatch.port';
import type { StationProfilesPort } from '@work/application/ports/station-profiles.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import type { ReplayAnswers } from '@work/application/services/replay-answers.service';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import { StationOrdering } from '@work/application/services/station-ordering';
import type { StationSkills } from '@work/application/services/station-skills.service';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { UnreplayableRunError } from '@work/domain/exceptions/unreplayable-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import {
  type ReplayPlan,
  replayPlanFor,
} from '@work/domain/services/replay-plan';
import { REPLAY_PRIORITY } from '@work/domain/services/replay-priority';
import { repositoriesReviewedOrAll } from '@work/domain/services/task-checkouts';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';

export interface ReplayInput {
  readonly original: RunId;
  readonly candidate: Line;
  readonly id?: RunId;
  readonly answer?: ReplayAnswer | null;
}

export class DispatchReplay {
  private readonly ordering: StationOrdering;

  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly tasks: TaskRepository,
    private readonly briefedTasks: BriefedTasksPort,
    private readonly ids: IdGeneratorPort,
    harnesses: HarnessCatalog,
    launch: HarnessLaunchPort,
    private readonly tracing: TraceParentPort,
    builtInSkills: BuiltInSkillsPort,
    teamSkills: StationSkills,
    catalog: StationCatalog,
    profiles: StationProfilesPort,
    private readonly memories: MemoriesBriefedBeforePort,
    private readonly files: AttachmentStorePort,
    hash: ContentHashPort,
    private readonly answers: ReplayAnswers,
  ) {
    this.ordering = new StationOrdering(
      harnesses,
      launch,
      builtInSkills,
      teamSkills,
      catalog,
      profiles,
      hash,
    );
  }

  async enqueue({
    original,
    candidate,
    id: requestedId,
    answer = null,
  }: ReplayInput): Promise<RunId> {
    if (requestedId && (await this.alreadyQueued(requestedId, original))) {
      return requestedId;
    }

    const replayed = await this.runs.findById(original);

    if (!replayed) {
      throw new UnreplayableRunError(
        original.value,
        'unknown-run',
        'Run not found.',
      );
    }

    const id = requestedId ?? RunId.of(this.ids.generate());
    const plan = await this.planned(replayed, candidate, id);
    const ordered = await this.ordering.orderedForReplay(candidate, plan.at);

    if (!ordered) {
      throw new UnreplayableRunError(
        original.value,
        'cannot-start',
        'The candidate station has no harness a runner can start.',
      );
    }

    const { order, folders, home } = ordered;
    const memories = await this.memories.again(
      {
        teamId: candidate.teamId,
        lineId: candidate.id.value,
        stationId: plan.at.stationId.value,
        repositories: repositoriesReviewedOrAll(
          plan.briefed.reviewing,
          candidate,
        ),
      },
      replayed.briefedWith.value,
      plan.startedAt,
    );
    const briefed = TaskBriefing.brief({
      task: plan.briefed,
      line: candidate,
      skills: folders.map((each) => each.skill),
      listedIn: home.readByHarness ? null : home.directory,
      memories: memories.briefed,
      memoryFolder: memories.folder,
      tools: [],
    });
    const answered = answer && (await this.answers.briefFor(replayed, answer));

    if (answer && !answered) {
      throw new UnreplayableRunError(
        original.value,
        'answer-gone',
        'The change people accepted or what they said is no longer there.',
      );
    }
    const briefing = answered ? `${briefed}\n\n${answered}` : briefed;

    const queued = Run.enqueue({
      id,
      workspaceId: replayed.workspaceId,
      harness: order.harness.id,
      priority: REPLAY_PRIORITY,
      subject: plan.subject,
      placement: order.placement,
      briefedWith: BriefedMemories.of({
        briefed: memories.briefed,
        omitted: memories.omitted,
      }),
      configuredAs: this.ordering.configuredAs(ordered, candidate),
      spec: RunSpec.of({
        ...this.ordering.laid(ordered, {
          briefing,
          naming: this.tracing.for(plan.taskId, id),
          attachments: plan.briefed.allAttachments,
        }),
        replay: plan.replay,
      }),
    });

    await this.runs.add(order.refusal ? queued.refused(order.refusal) : queued);

    return id;
  }

  async planned(
    replayed: Run,
    candidate: Line,
    id: RunId,
  ): Promise<ReplayPlan> {
    const plan = replayPlanFor({
      original: replayed,
      briefed: await this.briefedTasks.of(replayed.id),
      candidate,
      id,
    });

    if (!(await this.tasks.find(plan.taskId))) {
      throw new UnreplayableRunError(
        replayed.id.value,
        'task-gone',
        'Its task was deleted.',
      );
    }

    await this.stillStored(replayed, plan);
    await this.attachmentsStillStored(replayed, plan);

    return plan;
  }

  async alreadyQueued(id: RunId, original: RunId): Promise<boolean> {
    const queued = await this.runs.findById(id);

    if (!queued) {
      return false;
    }

    if (!queued.replayOf?.equals(original)) {
      throw new InconsistentStateError(
        'run',
        `${id.value} is already a run of something other than a replay of ${original.value}`,
      );
    }

    return true;
  }

  private async attachmentsStillStored(
    replayed: Run,
    plan: ReplayPlan,
  ): Promise<void> {
    await this.files
      .received(
        replayed.workspaceId,
        plan.briefed.allAttachments.map((each) => each.id),
      )
      .catch((error: unknown) => {
        if (error instanceof InvalidAttachmentError) {
          throw new UnreplayableRunError(
            replayed.id.value,
            'attachments-gone',
            'A file from its task briefing is no longer stored.',
          );
        }
        throw error;
      });
  }

  private async stillStored(replayed: Run, plan: ReplayPlan): Promise<void> {
    if (!plan.archive) {
      return;
    }

    const archive = await this.archives.find(plan.archive);

    if (!archive?.isAvailableIn(replayed.workspaceId)) {
      throw new UnreplayableRunError(
        replayed.id.value,
        'archive-gone',
        `Its workspace archive ${plan.archive.value} is no longer stored.`,
      );
    }
  }
}
