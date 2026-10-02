import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';
import type {
  CandidateResourceDto,
  StationChangeDto,
} from '@replays/application/dto/replays.dto';
import { CANDIDATE_KINDS } from '@replays/domain/value-objects/candidate-kind';

class StationChangeResponseDto {
  @ApiProperty({
    example: 'prompt',
    description:
      'What part of the station config changed: prompt, harness, model, effort, profile, image, repository, skill, tool, decisions, memories or judge',
  })
  readonly part: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: null,
    description:
      'Which one of the part changed: the repository, skill or tool, or the judge’s rubric, sample or trust',
  })
  readonly name: string | null;

  @ApiProperty({ enum: ['added', 'removed', 'changed'] })
  readonly kind: 'added' | 'removed' | 'changed';

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'What it was, where it can be shown; prompts, skills and rubrics are compared but not shown',
  })
  readonly was: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly now: string | null;

  constructor(change: StationChangeDto) {
    this.part = change.part;
    this.name = change.name;
    this.kind = change.kind;
    this.was = change.was;
    this.now = change.now;
  }
}

class ChangedFromResponseDto {
  @ApiProperty({
    example: '9f2c4e7a1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a',
    description:
      'The live config’s fingerprint when the candidate was proposed',
  })
  readonly fingerprint: string;

  @ApiProperty({
    type: StationChangeResponseDto,
    isArray: true,
    description:
      'What the candidate changes from that live config, as a run’s config changes are told; empty for a live candidate',
  })
  readonly changes: StationChangeResponseDto[];

  constructor(changedFrom: CandidateResourceDto['changedFrom']) {
    this.fingerprint = changedFrom.fingerprint;
    this.changes = changedFrom.changes.map(
      (each) => new StationChangeResponseDto(each),
    );
  }
}

export class ReplayCandidateResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({
    example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
    description: 'The team whose station it is for',
  })
  readonly teamId: string;

  @ApiProperty({
    example: '3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03',
    description: 'The line of that station',
  })
  readonly lineId: string;

  @ApiProperty({
    example: '6d1b8f3a-2c49-4e7d-a5f0-9b3e1c7d2a58',
    description:
      'The station it is for, as the team’s replay endpoints name it',
  })
  readonly stationId: string;

  @ApiProperty({
    example: 'core/delivery/build',
    description: 'The station it is for: team, line and station keys',
  })
  readonly stationAddress: string;

  @ApiProperty({
    example: 'Shorter prompt',
    description:
      'Tells it from the station’s other candidates; a proposed name is used once per station',
  })
  readonly name: string;

  @ApiProperty({
    enum: CANDIDATE_KINDS,
    description:
      'proposed by a person or a token; or live, a snapshot of the station’s config Spotlight takes to replay as a baseline, which only goes with its replays',
  })
  readonly kind: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The station block it replays the station under, in the shape the line resource holds a station in',
    example: {
      key: 'build',
      name: 'Build',
      kind: 'work',
      harness: 'claude-code',
      prompt: 'Build it, then drain the queue.',
      passesTo: ['ship'],
    },
  })
  readonly station: Record<string, unknown>;

  @ApiProperty({
    example: '5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c',
    description:
      'The StationConfig fingerprint the candidate runs under, as runs record theirs',
  })
  readonly fingerprint: string;

  @ApiProperty({ type: ChangedFromResponseDto })
  readonly changedFrom: ChangedFromResponseDto;

  @ApiProperty({ example: '2026-10-02T09:00:00.000Z' })
  readonly createdAt: string;

  constructor(candidate: CandidateResourceDto) {
    super(candidate);
    this.teamId = candidate.teamId;
    this.lineId = candidate.lineId;
    this.stationId = candidate.stationId;
    this.stationAddress = candidate.stationAddress;
    this.name = candidate.name;
    this.kind = candidate.kind;
    this.station = { ...candidate.station };
    this.fingerprint = candidate.fingerprint;
    this.changedFrom = new ChangedFromResponseDto(candidate.changedFrom);
    this.createdAt = candidate.createdAt;
  }
}
