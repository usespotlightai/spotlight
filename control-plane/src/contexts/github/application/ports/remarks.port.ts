import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RemarkAnswer {
  readonly workspaceId: WorkspaceId;
  readonly repository: Repository;
  readonly pullRequest: PullRequestUrl;
  readonly remark: string;
  readonly body: string;
  readonly resolve: boolean;
}

export const REMARKS = Symbol('REMARKS');

export interface RemarksPort {
  answer(answer: RemarkAnswer): Promise<void>;
}
