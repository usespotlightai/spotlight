import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import type { Remark } from '@domain/value-objects/remark.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface RemarkAnswer {
  readonly installation: GitHubInstallation;
  readonly repository: Repository;
  readonly pullRequest: PullRequestUrl;
  readonly remark: Remark;
  readonly body: string;
  readonly resolve: boolean;
}

export const REMARKS = Symbol('REMARKS');

export interface RemarksPort {
  answer(answer: RemarkAnswer): Promise<void>;
}
