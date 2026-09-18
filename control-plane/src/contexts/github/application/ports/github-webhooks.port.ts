import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const GITHUB_WEBHOOKS = Symbol('GITHUB_WEBHOOKS');

export interface GitHubWebhooksPort {
  verifies(delivery: GitHubDelivery): boolean;

  idOf(delivery: GitHubDelivery): string;

  workspaceOf(delivery: GitHubDelivery): Promise<WorkspaceId | null>;

  receive(delivery: GitHubDelivery): Promise<void>;

  activityIn(delivery: GitHubDelivery): readonly PullRequestActivity[];
}
