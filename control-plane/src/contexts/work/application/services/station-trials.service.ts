import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunOrdersMapper } from '@work/application/mappers/run-orders.mapper';
import { TrialabilityMapper } from '@work/application/mappers/trialability.mapper';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { MemoriesBriefedBeforePort } from '@work/application/ports/memories-briefed-before.port';
import type { RunEvidencePort } from '@work/application/ports/run-evidence.port';
import type {
  StationTrialsPort,
  TrialFollowUp,
  TrialFollowUps,
  TrialOrdering,
  TrialRequest,
} from '@work/application/ports/station-trials.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { Answered } from '@work/application/rendering/answered';
import { TaskBriefing } from '@work/application/rendering/task-briefing';
import type { CandidateLines } from '@work/application/services/candidate-lines.service';
import type { StationOrdering } from '@work/application/services/station-ordering';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { DispatchVersionConflictError } from '@work/domain/exceptions/dispatch-version-conflict.error';
import { UntrialableRunError } from '@work/domain/exceptions/untrialable-run.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { feedbackAfter } from '@work/domain/services/feedback-after';
import { repositoriesReviewedOrAll } from '@work/domain/services/task-checkouts';
import {
  type TrialOriginal,
  trialPlanFor,
} from '@work/domain/services/trial-plan';
import {
  trialBlockOf,
  trialInputsBlockOf,
} from '@work/domain/services/trialability';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { UntrialableReason } from '@work/domain/value-objects/untrialable-reason';

const untrialable = (
  reason: UntrialableReason,
  description: string,
): TrialOrdering => ({
  outcome: 'untrialable',
  reason: TrialabilityMapper.reasonCode(reason),
  description,
});

interface Original {
  readonly facts: RunFacts;
  readonly dispatch: Dispatch;
  readonly task: Task;
  readonly briefed: BriefedTask;
  readonly trial: TrialOriginal;
}

export class StationTrials implements StationTrialsPort {
  constructor(
    private readonly facts: RunFactsPort,
    private readonly dispatches: DispatchRepository,
    private readonly tasks: TaskRepository,
    private readonly candidates: CandidateLines,
    private readonly ordering: StationOrdering,
    private readonly memories: MemoriesBriefedBeforePort,
    private readonly files: AttachmentStorePort,
    private readonly tracing: TraceParentPort,
    private readonly evidence: RunEvidencePort,
    private readonly clock: ClockPort,
  ) {}

  async followUpsOf(basedOn: string): Promise<TrialFollowUps | null> {
    const original = await this.dispatches.find(RunId.of(basedOn));

    if (original?.subject.kind !== 'task') {
      return null;
    }

    const evidenced = await this.evidence.of(basedOn);
    const task = await this.tasks.find(original.subject.taskId);

    return {
      accepted: Answered.hasAccepted(evidenced?.hunks ?? []),
      sentBack: Boolean(
        task && Answered.hasSentBack(feedbackAfter(task.notes, original.id)),
      ),
    };
  }

  async order(request: TrialRequest): Promise<TrialOrdering> {
    const runId = RunId.of(request.runId);
    const ordered = await this.alreadyOrdered(runId, request.basedOn);

    if (ordered) {
      return ordered;
    }

    try {
      return await this.ordered(runId, request);
    } catch (error) {
      if (error instanceof UntrialableRunError) {
        return untrialable(error.untrialableReason, error.description);
      }
      throw error;
    }
  }

  async withdraw(runId: string): Promise<void> {
    const trial = await this.dispatches.find(RunId.of(runId));

    if (trial?.subject.kind !== 'trial' || trial.settled) {
      return;
    }

    if (!trial.ending) {
      await this.dispatches.save(trial.refusedFor('withdrawn'));
    }
  }

  private async alreadyOrdered(
    runId: RunId,
    basedOn: string,
  ): Promise<TrialOrdering | null> {
    const known = await this.dispatches.find(runId);

    if (!known) {
      return null;
    }

    if (
      known.subject.kind !== 'trial' ||
      known.subject.basedOn.value !== basedOn
    ) {
      throw new InconsistentStateError(
        'dispatch',
        `${runId.value} is already a run of something other than a trial of ${basedOn}`,
      );
    }

    if (known.refusedBecause || !known.order) {
      return untrialable(
        'cannot-start',
        'Its trial was withdrawn before it was queued.',
      );
    }

    return RunOrdersMapper.toTrialOrdering(known.order);
  }

  private async ordered(
    runId: RunId,
    request: TrialRequest,
  ): Promise<TrialOrdering> {
    const original = await this.original(request);
    const current = await this.candidates.live(
      request.lineId,
      request.stationId,
    );

    if (!current) {
      return untrialable(
        'not-at-the-station',
        'the line no longer has the station of the run',
      );
    }

    const built = await this.candidates.withStation(
      current,
      request.config,
      request.repositories,
    );

    if (!built.ok) {
      return untrialable(
        'candidate-unfit',
        'the candidate no longer fits the current line',
      );
    }

    const candidate = built.line;
    const plan = trialPlanFor({
      original: original.trial,
      briefed: original.briefed,
      candidate,
    });

    const followedUp = await this.followUp(original, request.followUp);
    const inputsBlock = trialInputsBlockOf({
      filesStored: await this.files.stored(
        original.facts.workspaceId,
        original.briefed.allAttachments.map((each) => each.id),
      ),
      answer: !request.followUp
        ? 'not-asked'
        : followedUp === null
          ? 'gone'
          : 'present',
    });

    if (inputsBlock) {
      throw new UntrialableRunError(
        original.facts.runId.value,
        inputsBlock.reason,
        inputsBlock.description,
      );
    }

    const laidOut = await this.ordering.orderedForTrial(candidate, plan.at);

    if (!laidOut) {
      return untrialable(
        'cannot-start',
        'The candidate station has no harness a runner can start.',
      );
    }

    const { order, folders, home } = laidOut;
    const memories = await this.memories.again(
      {
        teamId: candidate.teamId,
        lineId: candidate.id.value,
        stationId: original.trial.stationId.value,
        repositories: repositoriesReviewedOrAll(
          original.briefed.reviewing,
          candidate,
        ),
      },
      original.dispatch.briefedMemories.value,
      original.trial.startedAt,
    );
    const briefed = TaskBriefing.brief({
      task: original.briefed,
      line: candidate,
      skills: folders.map((each) => each.skill),
      listedIn: home.readByHarness ? null : home.directory,
      memories: memories.briefed,
      memoryFolder: memories.folder,
      tools: [],
    });
    const briefing = followedUp ? `${briefed}\n\n${followedUp}` : briefed;
    const configuredAs = this.ordering.configuredAs(laidOut, candidate);
    const ordering = {
      outcome: 'ordered' as const,
      order: {
        runId: runId.value,
        workspaceId: original.facts.workspaceId.value,
        team: candidate.teamId.value,
        harness: order.harness.value,
        priority: RunPriority.trial.value,
        placement: {
          labelGroups: order.placement.labelGroups,
          image: order.placement.image?.value ?? null,
        },
        spec: this.ordering.laid(laidOut, {
          briefing,
          naming: this.tracing.for(original.trial.taskId, runId),
          attachments: original.briefed.allAttachments,
        }),
        restore: original.trial.archive
          ? { archive: original.trial.archive }
          : null,
        refusal:
          order.refusals.length > 0
            ? order.refusals.map((each) => ({ description: each.description }))
            : null,
      },
      fingerprint: configuredAs?.fingerprint ?? null,
      checkouts: plan.checkouts,
      movesOnAfter: plan.movesOnAfter,
    };

    await this.recorded(
      Dispatch.trialOrdered({
        id: runId,
        workspaceId: original.facts.workspaceId,
        teamId: candidate.teamId,
        subject: {
          kind: 'trial',
          basedOn: original.facts.runId,
          taskId: original.trial.taskId,
          stationId: original.trial.stationId,
          asOf: original.trial.startedAt,
          repositories: plan.checkouts.map((each) => ({
            path: each.path,
            repository: Repository.of(each.repository),
          })),
          followUp: request.followUp,
        },
        configuredAs,
        briefedTask: original.briefed,
        briefing,
        briefedMemories: BriefedMemories.of({
          briefed: memories.briefed,
          omitted: memories.omitted,
        }),
        order: RunOrdersMapper.fromTrialOrdering(ordering),
        now: this.clock.now(),
      }),
    );

    return (await this.alreadyOrdered(runId, request.basedOn)) ?? ordering;
  }

  private async recorded(trial: Dispatch): Promise<void> {
    try {
      await this.dispatches.add(trial);
    } catch (error) {
      if (!(error instanceof DispatchVersionConflictError)) {
        throw error;
      }
    }
  }

  private async original(request: TrialRequest): Promise<Original> {
    const basedOn = RunId.of(request.basedOn);
    const [facts] = await this.facts.of([basedOn]);
    const dispatch = await this.dispatches.find(basedOn);
    const subject = dispatch?.subject.kind === 'task' ? dispatch.subject : null;
    const task = subject ? await this.tasks.find(subject.taskId) : null;
    const block = trialBlockOf(
      facts && {
        inWorkspace: facts.workspaceId.equals(
          WorkspaceId.of(request.workspaceId),
        ),
        taskId: subject?.taskId ?? null,
        stationId: subject?.stationId ?? null,
        ended: facts.ended,
        startedFrom: facts.startedFrom !== null,
        archive: TrialabilityMapper.archiveOf(facts),
        briefed: dispatch?.briefedTask !== null,
        taskExists: task !== null,
      },
    );

    if (block) {
      throw new UntrialableRunError(
        request.basedOn,
        block.reason,
        block.description,
      );
    }

    const startedFrom = facts?.startedFrom;

    if (!facts || !dispatch?.briefedTask || !subject || !task || !startedFrom) {
      throw new InconsistentStateError(
        'run',
        `${request.basedOn} passed the trial checks without the facts they read`,
      );
    }

    return {
      facts,
      dispatch,
      task,
      briefed: dispatch.briefedTask,
      trial: {
        runId: basedOn,
        taskId: subject.taskId,
        stationId: subject.stationId,
        archive: startedFrom.archiveId,
        startedAt: startedFrom.at,
        checkouts: startedFrom.checkouts,
      },
    };
  }

  private async followUp(
    original: Original,
    followUp: TrialFollowUp | null,
  ): Promise<string | null> {
    if (!followUp) {
      return null;
    }

    return followUp === 'accepted'
      ? Answered.accepted(
          (await this.evidence.of(original.facts.runId.value))?.hunks ?? [],
        )
      : Answered.sentBack(
          feedbackAfter(original.task.notes, original.facts.runId),
        );
  }
}
