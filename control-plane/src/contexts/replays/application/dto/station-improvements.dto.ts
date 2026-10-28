import type { ConfigPullRequestReasonDto } from '@replays/application/dto/config-pull-requests.dto';
import type { SearchSkipDto } from '@replays/application/dto/replays.dto';
import type { PickPhase } from '@replays/domain/services/pending-pick';
import type { StationImprovementStatus } from '@replays/domain/services/station-improvement';

export interface StationImprovementDto {
  readonly status: StationImprovementStatus;
  readonly searchId: string | null;
  readonly pickPhase: PickPhase | null;
  readonly pullRequestUrl: string | null;
  readonly improvedAt: string | null;
  readonly skip: SearchSkipDto | null;
  readonly pullRequestFailure: ConfigPullRequestReasonDto | null;
  readonly minimumTasks: number;
  readonly setId: string | null;
  readonly lastStartedAt: string | null;
  readonly checkAfter: string | null;
}
