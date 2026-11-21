import { ApiProperty } from '@nestjs/swagger';

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
  readonly more: boolean;

  constructor(redelivery: { readonly queued: number; readonly more: boolean }) {
    this.queued = redelivery.queued;
    this.more = redelivery.more;
  }
}
