import { ApiProperty } from '@nestjs/swagger';
import type {
  ConfigOriginDto,
  ConfigOriginsDto,
} from '@replays/application/dto/config-origins.dto';
import {
  ORIGIN_KINDS,
  type OriginKind,
} from '@replays/domain/value-objects/candidate-kind';

export class ConfigOriginResponseDto {
  @ApiProperty({ description: 'The station of the change asked about' })
  readonly stationId: string;

  @ApiProperty({
    example: 'run_1',
    description: 'The run of the change asked about, as asked',
  })
  readonly runId: string;

  @ApiProperty({ description: 'The config the station changed to' })
  readonly fingerprint: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-09-30T10:00:00.000Z',
    description: 'When the change took effect: when its run began',
  })
  readonly changedAt: string;

  @ApiProperty({ description: 'The candidate the change came from' })
  readonly candidateId: string;

  @ApiProperty({ example: 'one-comment-per-problem' })
  readonly name: string;

  @ApiProperty({
    enum: ORIGIN_KINDS,
    description: 'Found by a search, or proposed by a person or Terraform',
  })
  readonly kind: OriginKind;

  @ApiProperty()
  readonly lineId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The search that found it, for information only: a withdrawn candidate’s search may be gone too; null unless searched',
  })
  readonly searchId: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Its newest replay, for a proposed candidate still standing; null when searched, withdrawn or never replayed',
  })
  readonly replayId: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2026-09-29T16:00:00.000Z',
    description: 'When the candidate was made',
  })
  readonly createdAt: string;

  @ApiProperty({
    description:
      'Whether the candidate has since been withdrawn; a withdrawn origin still names it, but it has no page to link to',
  })
  readonly withdrawn: boolean;

  constructor(origin: ConfigOriginDto) {
    this.stationId = origin.stationId;
    this.runId = origin.runId;
    this.fingerprint = origin.fingerprint;
    this.changedAt = origin.changedAt;
    this.candidateId = origin.candidateId;
    this.name = origin.name;
    this.kind = origin.kind;
    this.lineId = origin.lineId;
    this.searchId = origin.searchId;
    this.replayId = origin.replayId;
    this.createdAt = origin.createdAt;
    this.withdrawn = origin.withdrawn;
  }
}

export class ConfigOriginsResponseDto {
  @ApiProperty({
    type: ConfigOriginResponseDto,
    isArray: true,
    description:
      'For each change asked about that came from a candidate, that candidate, in the order asked; changes with no origin are left out',
  })
  readonly origins: readonly ConfigOriginResponseDto[];

  constructor(read: ConfigOriginsDto) {
    this.origins = read.origins.map(
      (each) => new ConfigOriginResponseDto(each),
    );
  }
}
