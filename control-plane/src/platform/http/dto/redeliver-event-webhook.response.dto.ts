import { ApiProperty } from '@nestjs/swagger';
import type { Redelivery } from '@platform/events/event-delivery';

export class RedeliverEventWebhookResponseDto {
  @ApiProperty({
    example: 12,
    description:
      'How many dead letters Spotlight queued again. Each gets all its attempts again',
  })
  readonly queued: number;

  @ApiProperty({
    example: false,
    description:
      'Spotlight stopped at the limit, and more dead letters may wait. Send the same request again to queue them',
  })
  readonly truncated: boolean;

  constructor(redelivery: Redelivery) {
    this.queued = redelivery.queued;
    this.truncated = redelivery.truncated;
  }
}
