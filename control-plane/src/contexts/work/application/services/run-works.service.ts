import type {
  LeasedAttempt,
  LeasedRunFacts,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { ChatRunWork } from '@work/application/services/chat-run-work';
import { IsolatedRunWork } from '@work/application/services/isolated-run-work';
import type { RunWork } from '@work/application/services/run-work';
import { TaskRunWork } from '@work/application/services/task-run-work';
import { TrialRunWork } from '@work/application/services/trial-run-work';
import type { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { ChatMessage } from '@work/domain/entities/chat-message.entity';
import type { TaskNote } from '@work/domain/entities/task-note.entity';
import { LeaseLostError } from '@work/domain/exceptions/lease-lost.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { repositoryForTaskNamed } from '@work/domain/services/task-checkouts';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { trialRepositoryNamed } from '@work/domain/value-objects/dispatch-subject';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';

export interface LeasedRunWork {
  readonly run: LeasedRunFacts;
  readonly work: RunWork | null;
}

export interface CheckedRepository {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
}

export interface PendingMessage {
  readonly position: number;
  readonly body: string;
  readonly attachments: readonly Attachment[];
}

const pendingOf = (message: TaskNote | ChatMessage): PendingMessage => ({
  position: message.position.value,
  body: message.body.value,
  attachments: message.attachments,
});

const toldTheRun = (note: TaskNote, line: LineMap | null): PendingMessage => {
  const to = note.deferredMove ? line?.stationAt(note.deferredMove.to) : null;

  return to
    ? {
        ...pendingOf(note),
        body: TaskNoteBody.deferredMove(to.name, note.body).value,
      }
    : pendingOf(note);
};

export class RunWorks {
  constructor(
    private readonly leases: RunLeasesPort,
    private readonly runCommands: RunsPort,
    private readonly tasks: TaskRepository,
    private readonly chats: ChatRepository,
    private readonly lines: LineMapsPort,
    private readonly dispatches: DispatchRepository,
    private readonly clock: ClockPort,
  ) {}

  async leasedBy(runId: string, runnerId: string): Promise<LeasedRunWork> {
    const run = await this.leases.leaseOf(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );

    return { run, work: await this.workOf(run) };
  }

  async leasedRunWork(
    runId: string,
    runnerId: string,
  ): Promise<LeasedRunWork | null> {
    const run = await this.leases.leasedBy(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );

    return run ? { run, work: await this.workOf(run) } : null;
  }

  async workLeasedBy(runId: string, runnerId: string): Promise<RunWork | null> {
    const run = await this.leases.leasedBy(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );

    return run ? this.workOf(run) : null;
  }

  async pendingFor(
    runId: string,
    runnerId: string,
  ): Promise<readonly PendingMessage[] | null> {
    const run = await this.leases.leasedBy(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );

    if (!run) {
      return null;
    }

    const subject = (await this.dispatches.find(run.runId))?.subject;

    if (subject?.kind === 'task') {
      const task = await this.tasks.find(subject.taskId);

      if (!task) {
        return [];
      }

      const line = await this.lines.findByStation(task.stationId);

      return task.pendingFor(run.runId).map((note) => toldTheRun(note, line));
    }

    if (subject?.kind === 'chat') {
      const chat = await this.chats.find(subject.chatId);

      return chat ? chat.pendingFor(run.runId).map(pendingOf) : [];
    }

    return [];
  }

  async stillOn(leased: LeasedAttempt, runnerId: string): Promise<void> {
    const still = await this.leases.isStillOn(
      leased.runId,
      leased.attempt,
      RunnerId.of(runnerId),
    );

    if (!still) {
      throw new LeaseLostError(leased.runId.value, leased.attempt);
    }
  }

  async repositoryForCheck(
    runId: RunId,
    name: string,
  ): Promise<CheckedRepository | null> {
    const dispatch = await this.dispatches.find(runId);
    const subject = dispatch?.subject;

    if (!dispatch || !subject || subject.kind === 'chat') {
      return null;
    }

    if (subject.kind === 'trial') {
      const tried = trialRepositoryNamed(subject.repositories, name);

      return tried
        ? { workspaceId: dispatch.workspaceId, repository: tried }
        : null;
    }

    const task = await this.tasks.find(subject.taskId);
    const line = await this.lines.findByStation(subject.stationId);
    const named = RepositoryName.parsed(name);
    const repository =
      line && named ? repositoryForTaskNamed(named, task, line) : null;

    return repository
      ? { workspaceId: dispatch.workspaceId, repository }
      : null;
  }

  private async workOf(run: LeasedRunFacts): Promise<RunWork | null> {
    const dispatch = await this.dispatches.find(run.runId);

    if (dispatch) {
      return this.dispatchedWork(run, dispatch);
    }

    return run.policy.actsBeyondItself
      ? null
      : new IsolatedRunWork(run, this.runCommands);
  }

  private async dispatchedWork(
    run: LeasedRunFacts,
    dispatch: Dispatch,
  ): Promise<RunWork | null> {
    const subject = dispatch.subject;

    switch (subject.kind) {
      case 'task': {
        const task = await this.tasks.find(subject.taskId);

        return task?.hasCurrentRun(run.runId)
          ? new TaskRunWork(
              run,
              task,
              subject.stationId,
              this.tasks,
              this.lines,
              this.clock,
            )
          : null;
      }
      case 'chat': {
        const chat = await this.chats.find(subject.chatId);

        return chat ? new ChatRunWork(run, chat, this.chats) : null;
      }
      case 'trial':
        return new TrialRunWork(
          run,
          (await this.dispatches.find(subject.basedOn))?.briefedTask ?? null,
          subject.repositories,
          this.runCommands,
        );
    }
  }
}
