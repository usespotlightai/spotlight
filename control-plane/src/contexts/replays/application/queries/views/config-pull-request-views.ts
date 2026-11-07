import type {
  CandidatePullRequestDto,
  ConfigPullRequestReasonDto,
} from '@replays/application/dto/config-pull-requests.dto';
import type { ReplayedPullRequestRow } from '@replays/application/ports/replayed-candidates-reader.port';
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
  pullRequest: ReplayedPullRequestRow,
): CandidatePullRequestDto => ({
  id: pullRequest.id.value,
  state: pullRequest.current,
  closedBecause: pullRequest.closedBecause,
  closeFailure: configPullRequestReasonView(pullRequest.closeFailure),
  url: pullRequest.url?.value ?? null,
  reason: configPullRequestReasonView(pullRequest.reason),
});
