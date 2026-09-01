import type { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import type { Remark } from '@domain/value-objects/remark.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface RemarkAnswer {
  readonly repository: Repository;
  readonly pullRequest: PullRequestUrl;
  readonly remark: Remark;
  readonly body: string;
  // Resolving the thread as well as answering it, where the host has threads.
  readonly resolve: boolean;
}

export const REMARKS = Symbol('REMARKS');

export interface RemarksPort {
  answer(answer: RemarkAnswer): Promise<void>;
}
