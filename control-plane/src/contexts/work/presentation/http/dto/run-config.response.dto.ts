import { ApiProperty } from '@nestjs/swagger';
import type { RunConfigDto } from '@work/application/dto/run-config.dto';
import {
  ConfigChangeResponseDto,
  StationConfigResponseDto,
} from '@work/presentation/http/dto/station-config.response.dto';

export class ConfigChangedSinceResponseDto {
  @ApiProperty({
    description: 'The station’s previous run, which ran another config',
  })
  readonly runId: string;

  @ApiProperty()
  readonly taskId: string;

  @ApiProperty()
  readonly fingerprint: string;

  @ApiProperty({ type: () => [ConfigChangeResponseDto] })
  readonly changes: ConfigChangeResponseDto[];

  constructor(from: NonNullable<RunConfigDto['changedSince']>) {
    this.runId = from.runId;
    this.taskId = from.taskId;
    this.fingerprint = from.fingerprint;
    this.changes = from.changes.map(
      (each) => new ConfigChangeResponseDto(each),
    );
  }
}

export class RunConfigResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The SHA-256 naming the station config the run ran with',
  })
  readonly fingerprint: string | null;

  @ApiProperty({ nullable: true, type: () => StationConfigResponseDto })
  readonly config: StationConfigResponseDto | null;

  @ApiProperty({ nullable: true, type: () => ConfigChangedSinceResponseDto })
  readonly changedSince: ConfigChangedSinceResponseDto | null;

  constructor(from: RunConfigDto) {
    this.fingerprint = from.fingerprint;
    this.config = from.config
      ? new StationConfigResponseDto(from.config)
      : null;
    this.changedSince = from.changedSince
      ? new ConfigChangedSinceResponseDto(from.changedSince)
      : null;
  }
}
