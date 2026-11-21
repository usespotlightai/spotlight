import { ApiProperty } from '@nestjs/swagger';
import { REDELIVERY_LIMIT } from '@platform/events/event-delivery';

export const LONGEST_REDELIVERY = 100_000;

export class RedeliverEventWebhookRequestDto {
  @ApiProperty({
    type: String,
    example: '2026-11-01T00:00:00Z',
    description:
      'Send again the dead letters of the events recorded at or after this time, as an ISO 8601 time',
  })
  readonly since!: string;

  @ApiProperty({
    type: Number,
    required: false,
    example: REDELIVERY_LIMIT,
    description: `At most this many dead letters, ${REDELIVERY_LIMIT} when left out, up to ${LONGEST_REDELIVERY}. While the answer says more, send the same request again`,
  })
  readonly limit?: number;
}
