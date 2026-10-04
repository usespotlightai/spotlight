import { ApiProperty } from '@nestjs/swagger';
import type { HeldRunDto } from '@work/application/dto/runner-activity.dto';
import {
  HELD_RUN_KINDS,
  type HeldRunKind,
} from '@work/application/ports/runner-activity-reader.port';

export class HeldRunResponseDto {
  @ApiProperty({ example: '3f9c1b7e-52a4-4d6f-8e1b-0a7c4d2f9b63' })
  readonly id: string;

  @ApiProperty({ example: 'claimed' })
  readonly state: string;

  @ApiProperty({
    enum: HELD_RUN_KINDS,
    description:
      'What the run is for: a task at a station, an agent chat, a replay, a search, or only the spec it was queued with',
  })
  readonly kind: HeldRunKind;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The team the run is for; null where it is for none',
  })
  readonly teamId: string | null;

  @ApiProperty({
    description:
      'Whether the caller reads the run’s team, and so may see its title and open it; false where the run is for no team',
  })
  readonly readable: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The task’s or chat’s title; null for a replay, a search or a run queued with only a spec, or where the caller cannot read the run’s team',
  })
  readonly title: string | null;

  constructor(run: HeldRunDto) {
    this.id = run.id;
    this.state = run.state;
    this.kind = run.kind;
    this.teamId = run.teamId;
    this.readable = run.readable;
    this.title = run.title;
  }
}

export class RunnerActivityResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly runnerId: string;

  @ApiProperty({
    type: HeldRunResponseDto,
    description: 'The run the runner is working on',
  })
  readonly currentRun: HeldRunResponseDto;

  constructor(runnerId: string, currentRun: HeldRunResponseDto) {
    this.runnerId = runnerId;
    this.currentRun = currentRun;
  }
}
