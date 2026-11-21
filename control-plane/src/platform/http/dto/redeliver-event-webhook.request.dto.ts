import { ApiProperty } from '@nestjs/swagger';
import {
  MAX_REDELIVERY_LIMIT,
  REDELIVERY_LIMIT,
} from '@platform/events/event-delivery';

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
    description: `At most this many dead letters, ${REDELIVERY_LIMIT} when left out, up to ${MAX_REDELIVERY_LIMIT}. While the answer is truncated, send the same request again`,
  })
  readonly limit?: number;
}
