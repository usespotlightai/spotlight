import { ApiProperty } from '@nestjs/swagger';
import type { StationImprovementDto } from '@replays/application/dto/station-improvements.dto';
import {
  PICK_PHASES,
  type PickPhase,
} from '@replays/domain/services/pending-pick';
import {
  STATION_IMPROVEMENT_STATUSES,
  type StationImprovementStatus,
} from '@replays/domain/services/station-improvement';
import { ConfigPullRequestReasonResponseDto } from '@replays/presentation/http/dto/config-pull-requests.response.dto';
import { SearchSkipResponseDto } from '@replays/presentation/http/dto/replay-sets.response.dto';

export class StationImprovementResponseDto {
  @ApiProperty({
    enum: STATION_IMPROVEMENT_STATUSES,
    description:
      'What Spotlight does now to improve the station: a search runs, Spotlight picks a candidate of the last search or opens its pull request, a config pull request is open, the search policy is off, the station has no runs in its replay set yet, a person must act before Spotlight can improve the station, a merged pull request improved the station since the last search, or Spotlight waits for its next check',
  })
  readonly status: StationImprovementStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The search that runs, or whose pick is pending; null unless the status is searching or picking',
  })
  readonly searchId: string | null;

  @ApiProperty({
    nullable: true,
    enum: [...PICK_PHASES, null],
    description:
      'choosing while Spotlight has not picked a candidate of the finished search, opening while the picked candidate has no pull request yet; null unless the status is picking',
  })
  readonly pickPhase: PickPhase | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'https://github.com/acme/platform/pull/7',
    description:
      'The open config pull request, or the merged one that improved the station; null for other statuses, and while the pull request is not on GitHub yet',
  })
  readonly pullRequestUrl: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'When a merged config pull request improved the station; null unless the status is improved',
  })
  readonly improvedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: SearchSkipResponseDto,
    description:
      'Why Spotlight cannot start a search until a person acts; null unless the status is not-improving because of a skip',
  })
  readonly skip: SearchSkipResponseDto | null;

  @ApiProperty({
    nullable: true,
    type: ConfigPullRequestReasonResponseDto,
    description:
      'Why the newest config pull request of the station could not be opened; null unless the status is not-improving because of it',
  })
  readonly pullRequestFailure: ConfigPullRequestReasonResponseDto | null;

  @ApiProperty({
    example: 5,
    description:
      'The fewest different tasks a set needs before Spotlight can search it',
  })
  readonly minimumTasks: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The replay set Spotlight keeps for the station; null while it keeps none',
  })
  readonly setId: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'When Spotlight last started a search of the station; null before the first',
  })
  readonly lastStartedAt: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'When Spotlight next looks at the station; null while it keeps no replay set',
  })
  readonly checkAfter: string | null;

  constructor(improvement: StationImprovementDto) {
    this.status = improvement.status;
    this.searchId = improvement.searchId;
    this.pickPhase = improvement.pickPhase;
    this.pullRequestUrl = improvement.pullRequestUrl;
    this.improvedAt = improvement.improvedAt;
    this.skip = improvement.skip && new SearchSkipResponseDto(improvement.skip);
    this.pullRequestFailure =
      improvement.pullRequestFailure &&
      new ConfigPullRequestReasonResponseDto(improvement.pullRequestFailure);
    this.minimumTasks = improvement.minimumTasks;
    this.setId = improvement.setId;
    this.lastStartedAt = improvement.lastStartedAt;
    this.checkAfter = improvement.checkAfter;
  }
}
