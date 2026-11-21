import { ApiProperty } from '@nestjs/swagger';

export class EventWebhookRedeliveryResponseDto {
  @ApiProperty({
    example: 12,
    description:
      'How many dead letters Spotlight queued again. Each gets all its attempts again',
  })
  readonly queued: number;

  constructor(queued: number) {
    this.queued = queued;
  }
}
