import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const REVIEW_LINKS = Symbol('REVIEW_LINKS');

export interface ChangeStackPage {
  readonly slug: string;
  readonly teamId: TeamId;
  readonly runId: RunId;
}

export interface DecisionsPage {
  readonly slug: string;
  readonly teamId: TeamId;
  readonly taskId: TaskId;
}

export interface ReviewLinksPort {
  changeStackOf(page: ChangeStackPage): string;

  decisionsOf(page: DecisionsPage): string;
}
