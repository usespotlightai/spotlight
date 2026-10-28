import type {
  CandidatePullRequestDto,
  ConfigPullRequestDto,
  ConfigPullRequestReasonDto,
} from '@replays/application/dto/config-pull-requests.dto';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';

const reasonView = (
  reason: ConfigPullRequestReason | null,
): ConfigPullRequestReasonDto | null =>
  reason && {
    code: reason.code,
    message: reason.message,
    attribute: reason.attribute,
    expression: reason.expression,
    wanted: reason.wanted,
  };

export const configPullRequestView = (
  pullRequest: ConfigPullRequest,
): ConfigPullRequestDto => ({
  id: pullRequest.id.value,
  teamId: pullRequest.teamId.value,
  searchId: pullRequest.searchId.value,
  candidateId: pullRequest.candidateId.value,
  candidateName: pullRequest.candidateName,
  lineId: pullRequest.station.lineId,
  stationId: pullRequest.station.stationId,
  stationKey: pullRequest.stationKey,
  repository: pullRequest.repository,
  path: pullRequest.path,
  branch: pullRequest.branch,
  state: pullRequest.current,
  url: pullRequest.url,
  reason: reasonView(pullRequest.reason),
  createdAt: pullRequest.createdAt.toISOString(),
  updatedAt: pullRequest.updatedAt.toISOString(),
});

export const candidatePullRequestView = (
  pullRequest: ConfigPullRequest,
): CandidatePullRequestDto => ({
  id: pullRequest.id.value,
  state: pullRequest.current,
  url: pullRequest.url,
  reason: reasonView(pullRequest.reason),
});
