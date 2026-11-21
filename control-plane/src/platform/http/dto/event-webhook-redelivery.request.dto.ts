import { ApiProperty } from '@nestjs/swagger';

export class EventWebhookRedeliveryRequestDto {
  @ApiProperty({
    type: String,
    example: '2026-11-01T00:00:00Z',
    description:
      'Send again the dead letters of the events recorded at or after this time, as an ISO 8601 time',
  })
  readonly since!: string;
}
