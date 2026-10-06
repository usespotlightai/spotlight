import { ApiProperty } from '@nestjs/swagger';
import { MOST_CHANGES } from '@replays/domain/services/changes-asked-about';

export class ConfigChangeRequestDto {
  @ApiProperty({ description: 'The station whose config changed' })
  readonly stationId!: string;

  @ApiProperty({
    example: 'run_1',
    description:
      'The run the change took effect with: its first run with the config, as an insights change marker names it',
  })
  readonly runId!: string;
}

export class ReadConfigOriginsRequestDto {
  @ApiProperty({
    type: ConfigChangeRequestDto,
    isArray: true,
    maxItems: MOST_CHANGES,
    description: `The config changes to find origins for, each named by its station and first run; a run at a station asked about twice counts once. At most ${MOST_CHANGES} changes.`,
  })
  readonly changes!: readonly ConfigChangeRequestDto[];
}
