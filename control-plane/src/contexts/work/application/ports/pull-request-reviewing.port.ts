import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const PULL_REQUEST_REVIEWING = Symbol('PULL_REQUEST_REVIEWING');

export interface ReviewingRun {
  readonly runId: RunId;
  readonly taskId: TaskId;
}

export interface LeftComment {
  readonly path: string;
  readonly line: number;
  readonly startLine: number | null;
  readonly side: string;
  readonly body: string;
}

export interface SubmittedVerdict {
  readonly verdict: string;
  readonly body: string;
}

export interface PullRequestReviewingPort {
  comment(on: ReviewingRun, comment: LeftComment): Promise<string>;

  submit(on: ReviewingRun, review: SubmittedVerdict): Promise<string>;
}
