import { ApiProperty } from '@nestjs/swagger';
import type {
  CandidatePullRequestDto,
  ConfigPullRequestDto,
  ConfigPullRequestReasonDto,
} from '@replays/application/dto/config-pull-requests.dto';
import {
  CONFIG_PULL_REQUEST_ERRORS,
  CONFIG_PULL_REQUEST_STATES,
} from '@replays/domain/value-objects/config-pull-request-state';

export class ConfigPullRequestReasonResponseDto {
  @ApiProperty({
    enum: CONFIG_PULL_REQUEST_ERRORS,
    example: 'computed-attribute',
    description:
      'Why Spotlight would not open it: the line names no source; the GitHub App cannot access the repository; the file is missing or does not parse; the station’s block was not found exactly once; an attribute it would change is computed in Terraform; the file changed since the search began; or GitHub answered with an error',
  })
  readonly code: string;

  @ApiProperty({
    example:
      'Terraform computes `prompt` from `local.build_prompt`. Please change it by hand.',
  })
  readonly message: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'prompt',
    description: 'The station attribute it is about, where there is one',
  })
  readonly attribute: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'local.build_prompt',
    description:
      'The Terraform expression that computes the attribute, for a computed attribute',
  })
  readonly expression: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'The value the candidate wants for a computed attribute, to set by hand',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: {} },
    ],
  })
  readonly wanted: unknown;

  constructor(reason: ConfigPullRequestReasonDto) {
    this.code = reason.code;
    this.message = reason.message;
    this.attribute = reason.attribute;
    this.expression = reason.expression;
    this.wanted = reason.wanted;
  }
}

export class CandidatePullRequestResponseDto {
  @ApiProperty({ example: '0b6f1c2e-7a44-4d35-9e8a-3f5d2c1b7a90' })
  readonly id: string;

  @ApiProperty({ enum: CONFIG_PULL_REQUEST_STATES, example: 'opened' })
  readonly state: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'https://github.com/acme/platform/pull/42',
    description: 'The pull request, once it opened',
  })
  readonly url: string | null;

  @ApiProperty({
    type: ConfigPullRequestReasonResponseDto,
    nullable: true,
    description: 'Why it failed; null unless it failed',
  })
  readonly reason: ConfigPullRequestReasonResponseDto | null;

  constructor(pullRequest: CandidatePullRequestDto) {
    this.id = pullRequest.id;
    this.state = pullRequest.state;
    this.url = pullRequest.url;
    this.reason = pullRequest.reason
      ? new ConfigPullRequestReasonResponseDto(pullRequest.reason)
      : null;
  }
}

export class ConfigPullRequestResponseDto extends CandidatePullRequestResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly teamId: string;

  @ApiProperty({ example: '5d1e2f3a-4b5c-4d6e-8f70-1a2b3c4d5e6f' })
  readonly searchId: string;

  @ApiProperty({ example: '7a8b9c0d-1e2f-4a3b-9c4d-5e6f7a8b9c0d' })
  readonly candidateId: string;

  @ApiProperty({ example: 'in-order' })
  readonly candidateName: string;

  @ApiProperty({ example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  readonly lineId: string;

  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly stationId: string;

  @ApiProperty({ example: 'build' })
  readonly stationKey: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'acme/platform',
    description:
      'The repository that the line’s source named when it was picked; null when the line named none',
  })
  readonly repository: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'teams/core/delivery.tf',
  })
  readonly path: string | null;

  @ApiProperty({
    example: 'spotlight/search-5d1e2f3a-in-order',
    description: 'The branch Spotlight commits the change to',
  })
  readonly branch: string;

  @ApiProperty({
    example: 1,
    description:
      'How many times a person picked it. Each pick after a failure starts a new generation',
  })
  readonly generation: number;

  @ApiProperty({ example: '2026-10-02T09:00:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({ example: '2026-10-02T09:00:05.000Z' })
  readonly updatedAt: string;

  constructor(pullRequest: ConfigPullRequestDto) {
    super(pullRequest);
    this.teamId = pullRequest.teamId;
    this.searchId = pullRequest.searchId;
    this.candidateId = pullRequest.candidateId;
    this.candidateName = pullRequest.candidateName;
    this.lineId = pullRequest.lineId;
    this.stationId = pullRequest.stationId;
    this.stationKey = pullRequest.stationKey;
    this.repository = pullRequest.repository;
    this.path = pullRequest.path;
    this.branch = pullRequest.branch;
    this.generation = pullRequest.generation;
    this.createdAt = pullRequest.createdAt;
    this.updatedAt = pullRequest.updatedAt;
  }
}
