import type { OpenedPullRequestDto } from '@application/dto/pull-request.dto';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface PullRequestOpening {
  readonly repository: Repository;
  readonly branch: string;
  readonly title: string;
  readonly body: string;
}

export const PULL_REQUESTS = Symbol('PULL_REQUESTS');

export interface PullRequestPort {
  open(opening: PullRequestOpening): Promise<OpenedPullRequestDto>;
}
