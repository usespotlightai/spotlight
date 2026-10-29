import type {
  CandidatePullRequestDto,
  ConfigPullRequestReasonDto,
} from '@replays/application/dto/config-pull-requests.dto';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';

const configPullRequestReasonView = (
  reason: ConfigPullRequestReason | null,
): ConfigPullRequestReasonDto | null =>
  reason && {
    code: reason.code,
    message: reason.message,
    attribute: reason.attribute,
    expression: reason.expression,
    wanted: reason.wanted,
  };

export const candidatePullRequestView = (
  pullRequest: ConfigPullRequest,
): CandidatePullRequestDto => ({
  id: pullRequest.id.value,
  state: pullRequest.current,
  closedBecause: pullRequest.closedBecause,
  closeFailure: configPullRequestReasonView(pullRequest.closeFailure),
  url: pullRequest.url,
  reason: configPullRequestReasonView(pullRequest.reason),
});
