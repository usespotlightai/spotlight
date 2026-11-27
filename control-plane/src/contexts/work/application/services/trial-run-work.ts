import type { LeasedRunFacts } from '@runs/application/ports/run-leases.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { GitService } from '@work/application/dto/git-call.dto';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type {
  Cleared,
  ConnectionAsked,
  PermissionCleared,
  RunWork,
} from '@work/application/services/run-work';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import {
  type TrialRepository,
  trialRepositoryNamed,
} from '@work/domain/value-objects/dispatch-subject';

const NO_PERSON =
  'This run asks no person: it acts on nothing beyond its own result.';

export interface TrialOf {
  readonly taskId: TaskId;
  readonly stationId: StationId;
  readonly briefed: BriefedTask | null;
  readonly repositories: readonly TrialRepository[];
}

export class TrialRunWork implements RunWork {
  constructor(
    private readonly run: LeasedRunFacts,
    private readonly trial: TrialOf,
    private readonly asking: RunsPort,
  ) {}

  get workspaceId(): WorkspaceId {
    return this.run.workspaceId;
  }

  acknowledgeUpTo(): Promise<void> {
    return Promise.reject(
      new NotAllowedForIsolatedRunError('acknowledge the messages of a person'),
    );
  }

  attachment(attachmentId: string): Attachment | null {
    return (
      this.trial.briefed?.allAttachments.find(
        (each) => each.id.value === attachmentId,
      ) ?? null
    );
  }

  repositoryNamed(
    name: string,
    service: GitService,
  ): Promise<Repository | null> {
    if (service !== 'git-upload-pack') {
      return Promise.reject(
        new NotAllowedForIsolatedRunError(`push to ${name}`),
      );
    }

    return Promise.resolve(trialRepositoryNamed(this.trial.repositories, name));
  }

  readonly limitsPushes = false;

  pushRefusal(): Promise<string | null> {
    return Promise.resolve(null);
  }

  async pushed(): Promise<void> {}

  toolContext(): Promise<TaskToolContext> {
    return Promise.resolve({
      kind: 'task',
      runId: this.run.runId,
      workspaceId: this.run.workspaceId,
      taskId: this.trial.taskId,
      stationId: this.trial.stationId,
      requester: null,
    });
  }

  clearFor(declared: DeclaredTool): Promise<Cleared> {
    return Promise.resolve(
      declared.callableInIsolatedRun
        ? { kind: 'approved', edited: null, returned: async () => {} }
        : { kind: 'dismissed', reason: NO_PERSON },
    );
  }

  askToConnect(): Promise<ConnectionAsked> {
    return Promise.resolve({ kind: 'denied', reason: NO_PERSON });
  }

  async clearPermission(): Promise<PermissionCleared> {
    await this.asking.askedAPerson({
      runId: this.run.runId,
      runner: this.run.claimedBy,
    });

    return 'pending';
  }
}
