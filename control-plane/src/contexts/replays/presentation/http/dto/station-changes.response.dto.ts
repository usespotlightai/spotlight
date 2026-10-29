import { ApiProperty } from '@nestjs/swagger';
import type { StationChangeDto } from '@replays/application/dto/replays.dto';

export class StationChangeResponseDto {
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
      'Which one of the part changed: the repository, skill or tool, or the judge’s rubric, sample or minimum agreement',
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
