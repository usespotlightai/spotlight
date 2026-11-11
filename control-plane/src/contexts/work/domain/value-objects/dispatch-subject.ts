import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import type { TrialFollowUp } from '@work/domain/value-objects/trial-follow-up';

export interface TrialRepository {
  readonly path: string;
  readonly repository: Repository;
}

export type DispatchSubject =
  | {
      readonly kind: 'task';
      readonly taskId: TaskId;
      readonly revision: TaskRevision;
      readonly stationId: StationId;
    }
  | { readonly kind: 'chat'; readonly chatId: ChatId }
  | {
      readonly kind: 'trial';
      readonly basedOn: RunId;
      readonly taskId: TaskId;
      readonly stationId: StationId;
      readonly asOf: Date | null;
      readonly repositories: readonly TrialRepository[];
      readonly followUp: TrialFollowUp | null;
    };

export type DispatchKind = DispatchSubject['kind'];

export const taskOfDispatch = (subject: DispatchSubject): TaskId | null =>
  subject.kind === 'chat' ? null : subject.taskId;

export const stationOfDispatch = (subject: DispatchSubject): StationId | null =>
  subject.kind === 'chat' ? null : subject.stationId;

export const trialRepositoryNamed = (
  repositories: readonly TrialRepository[],
  name: string,
): Repository | null => {
  const found = repositories.find((each) => each.path === name);

  return found?.repository ?? null;
};
