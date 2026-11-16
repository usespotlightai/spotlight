import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HAND_BACK_NAMES,
  TAKEOVER_VERDICT_NAMES,
  UNSAID_TAKEOVER_VERDICT_NAME,
} from '@work/application/dto/task.dto';

export class TakeOverTaskRequestDto {
  @ApiPropertyOptional({
    enum: TAKEOVER_VERDICT_NAMES,
    enumName: 'TakeoverVerdict',
    default: UNSAID_TAKEOVER_VERDICT_NAME,
    description:
      'not-right where the line got it wrong, which counts against its last run; exploring where you only try something out',
  })
  readonly verdict?: (typeof TAKEOVER_VERDICT_NAMES)[number];

  @ApiPropertyOptional({
    example: 'Make the cards flat, without the nested border.',
    description: 'The first message to the agent. It starts the first turn.',
  })
  readonly body?: string;
}

export class HandBackTaskRequestDto {
  @ApiProperty({
    enum: HAND_BACK_NAMES,
    enumName: 'HandBack',
    description:
      'continue: the station agent goes on from your changes. move-on: the task moves to stationId. finish: the task ends its line.',
  })
  readonly next!: (typeof HAND_BACK_NAMES)[number];

  @ApiPropertyOptional({
    example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80',
    description: 'With move-on: a station the task’s station passes work to',
  })
  readonly stationId?: string;

  @ApiPropertyOptional({
    enum: TAKEOVER_VERDICT_NAMES,
    enumName: 'TakeoverVerdict',
    description: 'Changes the verdict given when the takeover started',
  })
  readonly verdict?: (typeof TAKEOVER_VERDICT_NAMES)[number];

  @ApiPropertyOptional({
    example: 'Cards are flat now. Keep the spacing.',
    description: 'What the station agent and the record should know',
  })
  readonly summary?: string;
}
