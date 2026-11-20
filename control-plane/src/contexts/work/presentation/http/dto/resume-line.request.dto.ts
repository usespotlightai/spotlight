import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HOLD_END_NAMES,
  HOLD_VERDICT_NAMES,
} from '@work/application/dto/task.dto';

export class ResumeLineRequestDto {
  @ApiProperty({
    enum: HOLD_END_NAMES,
    enumName: 'HoldEnd',
    description:
      'continue: the station agent goes on from your changes. move-on: the task moves to stationId. finish: the task ends its line.',
  })
  readonly next!: (typeof HOLD_END_NAMES)[number];

  @ApiPropertyOptional({
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
    description: 'With move-on: a station the task’s station passes work to',
  })
  readonly stationId?: string;

  @ApiPropertyOptional({
    enum: HOLD_VERDICT_NAMES,
    enumName: 'HoldVerdict',
    description:
      'Why the task is on hold. not-right counts against the last line run at the station; exploring does not. Without it, the hold counts as not-right.',
  })
  readonly verdict?: (typeof HOLD_VERDICT_NAMES)[number];

  @ApiPropertyOptional({
    example: 'Cards are flat now. Keep the spacing.',
    description: 'What the station agent and the record should know',
  })
  readonly summary?: string;
}
